import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

export interface AttendanceRecord {
  userId: string;
  name: string;
  inTime: Date;
  outTime: Date | null;
}

export interface DailyAttendanceDoc {
  date: string;
  records: AttendanceRecord[];
}

export class AttendanceDbService {
  private static getUserNameFromCache(userId: string, userDataPath: string): string {
    try {
      const filePath = path.join(userDataPath, 'device_users_archive.json');
      if (fs.existsSync(filePath)) {
        const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const user = users.find((u: any) => String(u.userId) === String(userId));
        if (user && user.name) {
          return user.name;
        }
      }
    } catch (err) {
      console.error('Error reading device users archive in DB service:', err);
    }
    return `User #${userId}`;
  }

  static async saveOrUpdatePunch(
    dbClient: MongoClient,
    collectionName: string,
    userId: string,
    punchTime: Date,
    userDataPath: string
  ): Promise<{ success: boolean; action: 'insert' | 'update' | 'noop'; error?: string }> {
    try {
      const db = dbClient.db("bioryx");
      const col = db.collection(collectionName);

      const year = punchTime.getFullYear();
      const month = String(punchTime.getMonth() + 1).padStart(2, '0');
      const day = String(punchTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const name = this.getUserNameFromCache(userId, userDataPath);

      const doc = await col.findOne({ date: dateStr });

      if (!doc) {
        await col.insertOne({
          date: dateStr,
          records: [
            {
              userId,
              name,
              inTime: punchTime,
              outTime: null
            }
          ]
        });
        return { success: true, action: 'insert' };
      }

      const records = doc.records || [];
      const userRecordExists = records.some((r: any) => String(r.userId) === String(userId));

      if (!userRecordExists) {
        await col.updateOne(
          { date: dateStr },
          {
            $push: {
              records: {
                userId,
                name,
                inTime: punchTime,
                outTime: null
              }
            } as any
          }
        );
        return { success: true, action: 'insert' };
      } else {
        const existingRecord = records.find((r: any) => String(r.userId) === String(userId));
        if (existingRecord) {
          const inTimeDate = new Date(existingRecord.inTime);
          if (punchTime.getTime() > inTimeDate.getTime()) {
            await col.updateOne(
              { date: dateStr, "records.userId": userId },
              {
                $set: {
                  "records.$.outTime": punchTime
                }
              }
            );
            return { success: true, action: 'update' };
          }
        }
      }
      return { success: true, action: 'noop' };
    } catch (err: any) {
      console.error('Failed to save/update punch in Daily Attendance collection:', err);
      return { success: false, action: 'noop', error: err.message };
    }
  }
}
