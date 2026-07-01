import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import taxonomy from "@/content/taxonomy.json";

interface Leaf {
  topic_id: string;
  group_id: string;
}

function getGroupId(topicId: string): string | null {
  for (const group of taxonomy.groups) {
    for (const leaf of group.leaves) {
      if (leaf.topic_id === topicId) {
        return group.group_id;
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topic_id");
  const difficulty = searchParams.get("difficulty");

  if (!topicId || !difficulty) {
    return NextResponse.json(
      { error: "topic_id and difficulty are required" },
      { status: 400 }
    );
  }

  const groupId = getGroupId(topicId);
  if (!groupId) {
    return NextResponse.json({ error: "unknown topic" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "content",
    "problems",
    groupId,
    `${topicId}.${difficulty}.json`
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ problems: [] });
  }

  const problems = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return NextResponse.json({ problems });
}
