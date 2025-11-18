import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized', needsAuth: true },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validar formato do sessionId
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Buscar dados do usuário no banco
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, cpf: true, email: true, name: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    if (!user.cpf) {
      return NextResponse.json(
        { error: 'User has no CPF registered' },
        { status: 400 }
      );
    }

    // Buscar dados da sessão Didit
    console.log('Fetching Didit session data for:', sessionId);
    console.log('Using API Key:', process.env.DIDIT_API_KEY ? 'Present' : 'Missing');
    
    // Tentar múltiplas URLs da API até encontrar a correta
    const possibleUrls = [
      `https://verification.didit.me/v2/session/${sessionId}/decision/`,
      `https://verification.didit.me/v2/session/${sessionId}/`,
      `https://api.didit.me/v2/session/${sessionId}/decision/`,
      `https://api.didit.me/v2/session/${sessionId}/`,
      `https://verification.didit.me/api/v2/session/${sessionId}/decision/`
    ];
    
    let diditResponse: Response | null = null;
    let workingUrl = '';
    
    for (const url of possibleUrls) {
      console.log('Trying URL:', url);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-api-key': process.env.DIDIT_API_KEY || '',
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          diditResponse = response;
          workingUrl = url;
          console.log('Success with URL:', url);
          break;
        } else if (response.status !== 404) {
          // Se não é 404, pode ser um erro diferente (401, 403, etc)
          console.log(`URL ${url} returned status:`, response.status);
        }
      } catch (error) {
        console.log(`Error with URL ${url}:`, error);
      }
    }
    
    if (!diditResponse) {
      // Se todas as URLs falharam, use a primeira como fallback para reportar erro
      diditResponse = await fetch(possibleUrls[0], {
        method: 'GET',
        headers: {
          'x-api-key': process.env.DIDIT_API_KEY || '',
          'Content-Type': 'application/json',
        },
      });
      workingUrl = possibleUrls[0];
    }

    if (!diditResponse.ok) {
      const error = await diditResponse.text();
      console.error('Didit API error:', {
        status: diditResponse.status,
        statusText: diditResponse.statusText,
        url: workingUrl || 'Unknown URL',
        error: error
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch Didit session data', 
          detail: error,
          status: diditResponse.status,
          sessionId: sessionId
        },
        { status: diditResponse.status }
      );
    }

    const diditData = await diditResponse.json();
    
    // Verificar o status da verificação DIDIT
    const verificationStatus = diditData.status;
    const idVerification = diditData.id_verification;
    
    console.log('DIDIT Verification Status:', {
      status: verificationStatus,
      id_verification: idVerification,
      sessionId: sessionId
    });

    // Verificar se a verificação foi aprovada (case-insensitive)
    const statusLower = verificationStatus?.toLowerCase();
    if (statusLower !== 'approved' && statusLower !== 'completed') {
      return NextResponse.json(
        {
          error: 'Document verification was not approved',
          status: verificationStatus,
          message: 'Please complete the document verification process successfully'
        },
        { status: 400 }
      );
    }

    // Verificar se há dados de verificação de ID (case-insensitive)
    const idStatusLower = idVerification?.status?.toLowerCase();
    if (!idVerification || idStatusLower !== 'approved') {
      return NextResponse.json(
        {
          error: 'ID verification was not successful',
          idVerificationStatus: idVerification?.status,
          message: 'Document verification did not pass all checks'
        },
        { status: 400 }
      );
    }

    // Buscar CPF nos dados extraídos do documento
    function findCpfInVerificationData(data: any): string | null {
      if (!data) {
        console.log('No data provided to findCpfInVerificationData');
        return null;
      }
      
      console.log('Searching for CPF in:', {
        extra_fields: data.extra_fields,
        tax_number: data.tax_number,
        document_number: data.document_number,
        identification_number: data.identification_number
      });
      
      // Possíveis locais onde o CPF pode estar
      const possibleCpfs = [
        data.extra_fields?.tax_number,
        data.tax_number,
        data.document_number,
        data.identification_number,
        data.extracted_data?.tax_number,
        data.extracted_data?.document_number,
        data.personal_details?.tax_number,
        data.document_details?.tax_number,
        data.document_details?.document_number
      ];

      console.log('Possible CPFs found:', possibleCpfs);

      for (let i = 0; i < possibleCpfs.length; i++) {
        const cpf = possibleCpfs[i];
        console.log(`Checking CPF ${i}:`, cpf, typeof cpf);
        
        if (cpf && typeof cpf === 'string') {
          const cleaned = cpf.replace(/\D/g, '');
          console.log(`CPF ${i} cleaned:`, cleaned, 'length:', cleaned.length);
          
          if (cleaned.length === 11) {
            console.log(`Found valid CPF: ${cpf}`);
            return cpf;
          }
        }
      }
      
      console.log('No valid CPF found');
      return null;
    }

    const diditCpf = findCpfInVerificationData(idVerification);
    
    console.log('CPF extraction result:', {
      found: !!diditCpf,
      value: diditCpf,
      user_cpf: user.cpf
    });

    if (!diditCpf) {
      // Log detalhado da estrutura de verificação para debug
      console.error('CPF not found in document verification data:', {
        id_verification: idVerification,
        user_cpf: user.cpf,
        verification_status: verificationStatus,
        sessionId: sessionId
      });
      
      return NextResponse.json(
        { 
          error: 'Could not extract CPF from verified document',
          message: 'The document was verified but CPF could not be extracted from the verification data',
          userCpf: user.cpf,
          verificationStatus: verificationStatus,
          idVerificationData: idVerification
        },
        { status: 400 }
      );
    }

    // Normalizar CPFs (remover pontuação)
    const normalizedUserCpf = user.cpf.replace(/\D/g, '');
    const normalizedDiditCpf = String(diditCpf).replace(/\D/g, '');

    const isMatch = normalizedUserCpf === normalizedDiditCpf;

    // Log para debug
    console.log('CPF Cross-Validation:', {
      user: {
        cpf: user.cpf,
        normalized: normalizedUserCpf
      },
      document: {
        cpf: String(diditCpf),
        normalized: normalizedDiditCpf
      },
      verification: {
        status: verificationStatus,
        isMatch,
        sessionId
      },
      message: isMatch 
        ? 'SUCCESS: User CPF matches document CPF' 
        : 'FAILURE: User CPF does not match document CPF'
    });

    return NextResponse.json({
      isMatch,
      userCpf: user.cpf,
      diditCpf: String(diditCpf),
      validation: {
        userCpf: user.cpf,
        documentCpf: String(diditCpf),
        verificationStatus: verificationStatus,
        sessionId: sessionId
      },
      message: isMatch 
        ? 'CPF validation successful: The CPF you provided matches the CPF in your verified document' 
        : 'CPF validation failed: The CPF you provided does not match the CPF in your verified document'
    });

  } catch (error) {
    console.error('Error validating CPF:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: String(error) },
      { status: 500 }
    );
  }
}
