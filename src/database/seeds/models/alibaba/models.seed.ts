import { UserStatus } from 'src/entities/User';
import {
  ALIBABA_IMAGE_MODELS,
  ALIBABA_TEXT_MODELS,
} from 'src/model-provider/alibaba-models';

export const ALIBABA_MODELS = [
  ...ALIBABA_TEXT_MODELS.map((model) => ({
    id: `alibaba:${model.name}`,
    provider_id: 6,
    name: model.name,
    description: model.description,
    for_image: false,
    available_for_status: model.status ?? UserStatus.SUBSCRIPTION_PLUS,
  })),
  ...ALIBABA_IMAGE_MODELS.map((model) => ({
    id: `alibaba:${model.name}`,
    provider_id: 6,
    name: model.name,
    description: model.description,
    for_image: true,
    available_for_status: UserStatus.SUBSCRIPTION_PLUS,
  })),
];
