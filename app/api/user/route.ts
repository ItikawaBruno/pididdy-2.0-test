import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Example endpoint to create/get users
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clerkUserId, email, name, cpf } = body;

    if (!clerkUserId || !email) {
      return NextResponse.json(
        { error: 'clerkUserId and email are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId }
    });

    if (existingUser) {
      return NextResponse.json({ user: existingUser });
    }

    const user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name,
        cpf: cpf ? cpf.replace(/\D/g, '') : null, // Store only digits
      },
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        verifications: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users, count: users.length });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', detail: error.message },
      { status: 500 }
    );
  }
}
