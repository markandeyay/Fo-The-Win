import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import taxonomy from "@/content/taxonomy.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const topicParam = searchParams.get("topic_ids") ?? searchParams.get("topic_id");
  const difficulty = searchParams.get("difficulty");

  if (!topicParam || !difficulty) {
    return NextResponse.json(
      { error: "topic_id or topic_ids and difficulty are required" },
      { status: 400 }
    );
  }

  const topicIds = [...new Set(topicParam.split(",").map((id) => id.trim()).filter(Boolean))];
  const problems = [];
  const unknownTopicIds: string[] = [];

  for (const topicId of topicIds) {
    const groupId = getGroupId(topicId);
    if (!groupId) {
      unknownTopicIds.push(topicId);
      continue;
    }

    const filePath = path.join(
      process.cwd(),
      "content",
      "problems",
      groupId,
      `${topicId}.${difficulty}.json`
    );

    if (!fs.existsSync(filePath)) {
      continue;
    }

    problems.push(...JSON.parse(fs.readFileSync(filePath, "utf-8")));
  }

  if (unknownTopicIds.length === topicIds.length) {
    return NextResponse.json({ error: "unknown topic" }, { status: 404 });
  }

  return NextResponse.json({ problems, unknown_topic_ids: unknownTopicIds });
}
