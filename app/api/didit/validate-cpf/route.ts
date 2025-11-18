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
    const diditResponse = await fetch(
      `https://verification.didit.me/v2/session/${sessionId}/`,
      {
        method: 'GET',
        headers: {
          'x-api-key': process.env.DIDIT_API_KEY || '',
        },
      }
    );

    if (!diditResponse.ok) {
      const error = await diditResponse.text();
      console.error('Didit API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch Didit session data', detail: error },
        { status: diditResponse.status }
      );
    }

    const diditData = await diditResponse.json();
    
    // Extrair CPF da resposta da Didit
    // A estrutura pode variar dependendo do workflow
    const diditCpf = diditData.document_number || 
                     diditData.cpf || 
                     diditData.identification_number ||
                     diditData.extracted_data?.document_number;
    
    if (!diditCpf) {
      console.error('CPF not found in Didit response:', diditData);
      return NextResponse.json(
        { 
          error: 'CPF not found in Didit verification response',
          diditData: diditData // Para debug
        },
        { status: 400 }
      );
    }

    // Normalizar CPFs (remover pontuação)
    const normalizedUserCpf = user.cpf.replace(/\D/g, '');
    const normalizedDiditCpf = String(diditCpf).replace(/\D/g, '');

    const isMatch = normalizedUserCpf === normalizedDiditCpf;

    // Log para debug
    console.log('CPF Validation:', {
      userCpf: normalizedUserCpf,
      diditCpf: normalizedDiditCpf,
      isMatch
    });

    return NextResponse.json({
      isMatch,
      userCpf: user.cpf,
      diditCpf: String(diditCpf),
      message: isMatch 
        ? 'CPF validated successfully' 
        : 'CPF mismatch - verification failed'
    });

  } catch (error) {
    console.error('Error validating CPF:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: String(error) },
      { status: 500 }
    );
  }
}
