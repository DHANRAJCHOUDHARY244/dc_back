import { messageRepository } from "@repositories";

export type UnreadStat = { chatId: number; unreadCount: number; mentionCount: number };

/** Single aggregation for unread + mention counts across many chats. */
export async function computeUnreadStatsForChats(
  userId: number,
  chatIds: number[],
): Promise<Map<number, UnreadStat>> {
  const result = new Map<number, UnreadStat>();
  if (!chatIds.length) return result;

  const rows: Array<{ _id: number; unreadCount: number; mentionCount: number }> =
    await messageRepository.aggregateRaw([
      {
        $match: {
          chatId: { $in: chatIds },
          senderId: { $ne: userId },
        },
      },
      {
        $lookup: {
          from: "chat_read_states",
          let: { cid: "$chatId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$chatId", "$$cid"] }, { $eq: ["$userId", userId] }],
                },
              },
            },
            { $project: { lastReadMessageId: 1, _id: 0 } },
          ],
          as: "readState",
        },
      },
      {
        $addFields: {
          lastRead: {
            $ifNull: [{ $arrayElemAt: ["$readState.lastReadMessageId", 0] }, 0],
          },
        },
      },
      { $match: { $expr: { $gt: ["$id", "$lastRead"] } } },
      {
        $group: {
          _id: "$chatId",
          unreadCount: { $sum: 1 },
          mentionCount: {
            $sum: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$mentions", []] },
                          as: "m",
                          cond: { $eq: ["$$m.userId", userId] },
                        },
                      },
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

  for (const row of rows) {
    result.set(row._id, {
      chatId: row._id,
      unreadCount: row.unreadCount,
      mentionCount: row.mentionCount,
    });
  }
  return result;
}

export async function computeUnreadForChat(
  userId: number,
  chatId: number,
  lastReadMessageId = 0,
): Promise<{ unreadCount: number; mentionCount: number }> {
  const baseFilter = {
    chatId,
    id: { $gt: lastReadMessageId },
    senderId: { $ne: userId },
  };
  const [unreadCount, mentionCount] = await Promise.all([
    messageRepository.count(baseFilter),
    messageRepository.count({
      ...baseFilter,
      mentions: { $elemMatch: { userId: Number(userId) } },
    }),
  ]);
  return { unreadCount, mentionCount };
}
