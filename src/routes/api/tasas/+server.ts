// src/routes/api/tasas/+server.ts
import { json } from '@sveltejs/kit';
import { tasasActuales } from '../../../hooks.server';

export async function GET() {
    return json(tasasActuales);
}