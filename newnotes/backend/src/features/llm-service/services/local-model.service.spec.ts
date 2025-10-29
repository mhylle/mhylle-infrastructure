import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalModelService } from './local-model.service';

describe('LocalModelService', () => {
  let service: LocalModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalModelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config = {
                'ollama.baseUrl': 'http://localhost:11434',
                'ollama.defaultModel': 'deepseek-r1:32b',
                'ollama.timeout': 60000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LocalModelService>(LocalModelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return provider name', () => {
    expect(service.getProviderName()).toBe('LocalModelService (Ollama)');
  });

  it('should return default config', () => {
    const config = service.getDefaultConfig();
    expect(config.model).toBe('deepseek-r1:32b');
    expect(config.temperature).toBe(0.7);
  });
});
