import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

export async function GET() {
  const { rows } = await pgPool.query(
    `SELECT career_key, name, description, is_locked, sort_order FROM careers ORDER BY sort_order, id`
  );
  return NextResponse.json({ careers: rows });
}
