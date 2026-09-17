import 'dotenv/config';

import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Chat } from 'src/entities/Chat';
import { FileEntity } from 'src/entities/File';
import { Model } from 'src/entities/Model';
import { ModelProvider } from 'src/entities/ModelProvider';
import { OauthAccount } from 'src/entities/OauthAccount';
import { Payment } from 'src/entities/Payment';
import { Prompt } from 'src/entities/Prompt';
import { PromptFile } from 'src/entities/PromptFile';
import { PromptMeta } from 'src/entities/PromptMeta';
import { Promotion } from 'src/entities/Promotion';
import { Session } from 'src/entities/Session';
import { Subscription } from 'src/entities/Subscription';
import { User } from 'src/entities/User';
import { UserPromotion } from 'src/entities/UserPromotion';
import { SubscriptionNotification } from 'src/entities/SubscriptionNotification';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    ca: readFileSync(join(process.cwd(), 'db.pem')),
  },
  synchronize: false,
  entities: [
    Chat,
    Prompt,
    PromptFile,
    PromptMeta,
    User,
    Session,
    ModelProvider,
    Model,
    OauthAccount,
    Payment,
    Subscription,
    FileEntity,
    Promotion,
    UserPromotion,
    SubscriptionNotification,
  ],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});
