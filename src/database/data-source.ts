import 'reflect-metadata';
import 'dotenv/config';

import { join } from 'path';
import { DataSource } from 'typeorm';
import { Chat } from '../entities/Chat';
import { FileEntity } from '../entities/File';
import { Model } from '../entities/Model';
import { ModelProvider } from '../entities/ModelProvider';
import { OauthAccount } from '../entities/OauthAccount';
import { Payment } from '../entities/Payment';
import { Prompt } from '../entities/Prompt';
import { PromptFile } from '../entities/PromptFile';
import { PromptMeta } from '../entities/PromptMeta';
import { Promotion } from '../entities/Promotion';
import { Session } from '../entities/Session';
import { Subscription } from '../entities/Subscription';
import { SubscriptionNotification } from '../entities/SubscriptionNotification';
import { User } from '../entities/User';
import { UserPromotion } from '../entities/UserPromotion';
import { getDatabaseConnectionOptions } from './config';

export default new DataSource({
  type: 'postgres',
  ...getDatabaseConnectionOptions((key) => process.env[key]),
  synchronize: false,
  dropSchema: false,
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
  migrations: [
    join(
      __dirname,
      'migrations',
      `*.${__filename.endsWith('.ts') ? 'ts' : 'js'}`,
    ),
  ],
});
