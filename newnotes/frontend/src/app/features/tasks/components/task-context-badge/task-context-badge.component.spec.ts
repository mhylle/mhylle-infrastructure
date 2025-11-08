import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TaskContextBadgeComponent } from './task-context-badge.component';
import { TasksApiService } from '../../../../core/services/tasks-api.service';
import { TaskContext } from '../../../../core/models/task.model';

describe('TaskContextBadgeComponent', () => {
  let component: TaskContextBadgeComponent;
  let fixture: ComponentFixture<TaskContextBadgeComponent>;
  let tasksApiService: jasmine.SpyObj<TasksApiService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const tasksApiServiceSpy = jasmine.createSpyObj('TasksApiService', ['getTaskContext']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [TaskContextBadgeComponent],
      providers: [
        { provide: TasksApiService, useValue: tasksApiServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    tasksApiService = TestBed.inject(TasksApiService) as jasmine.SpyObj<TasksApiService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture = TestBed.createComponent(TaskContextBadgeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load context on init', () => {
    const mockContext: TaskContext = {
      sourceType: 'chat',
      sourceId: 'chat-123',
      sourceDetails: { title: 'Test Chat' }
    };
    tasksApiService.getTaskContext.and.returnValue(of(mockContext));
    component.taskId = 'task-123';

    component.ngOnInit();

    expect(tasksApiService.getTaskContext).toHaveBeenCalledWith('task-123');
    expect(component.context()).toEqual(mockContext);
    expect(component.loading()).toBe(false);
  });

  it('should handle error when loading context', () => {
    tasksApiService.getTaskContext.and.returnValue(throwError(() => new Error('API Error')));
    component.taskId = 'task-123';

    component.ngOnInit();

    expect(component.context()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  describe('getIcon', () => {
    it('should return chat_bubble icon for chat source', () => {
      component.context.set({ sourceType: 'chat' });
      expect(component.getIcon()).toBe('chat_bubble');
    });

    it('should return note icon for note source', () => {
      component.context.set({ sourceType: 'note' });
      expect(component.getIcon()).toBe('note');
    });

    it('should return edit icon for manual source', () => {
      component.context.set({ sourceType: 'manual' });
      expect(component.getIcon()).toBe('edit');
    });
  });

  describe('getLabel', () => {
    it('should return "From Chat" for chat source', () => {
      component.context.set({ sourceType: 'chat' });
      expect(component.getLabel()).toBe('From Chat');
    });

    it('should return note title for note source with details', () => {
      component.context.set({
        sourceType: 'note',
        sourceDetails: { title: 'My Note' }
      });
      expect(component.getLabel()).toBe('From: My Note');
    });

    it('should return "From Note" for note source without details', () => {
      component.context.set({ sourceType: 'note' });
      expect(component.getLabel()).toBe('From Note');
    });

    it('should return "Manual" for manual source', () => {
      component.context.set({ sourceType: 'manual' });
      expect(component.getLabel()).toBe('Manual');
    });
  });

  describe('isClickable', () => {
    it('should return true for chat source with sourceId', () => {
      component.context.set({ sourceType: 'chat', sourceId: 'chat-123' });
      expect(component.isClickable()).toBe(true);
    });

    it('should return true for note source with sourceId', () => {
      component.context.set({ sourceType: 'note', sourceId: 'note-123' });
      expect(component.isClickable()).toBe(true);
    });

    it('should return false for manual source', () => {
      component.context.set({ sourceType: 'manual' });
      expect(component.isClickable()).toBe(false);
    });

    it('should return false without sourceId', () => {
      component.context.set({ sourceType: 'chat' });
      expect(component.isClickable()).toBe(false);
    });
  });

  describe('handleClick', () => {
    it('should navigate to chat for chat source', () => {
      component.context.set({ sourceType: 'chat', sourceId: 'chat-123' });
      component.handleClick();
      expect(router.navigate).toHaveBeenCalledWith(['/chat'], { queryParams: { id: 'chat-123' } });
    });

    it('should navigate to note for note source', () => {
      component.context.set({ sourceType: 'note', sourceId: 'note-123' });
      component.handleClick();
      expect(router.navigate).toHaveBeenCalledWith(['/notes', 'note-123']);
    });

    it('should not navigate for manual source', () => {
      component.context.set({ sourceType: 'manual' });
      component.handleClick();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate without sourceId', () => {
      component.context.set({ sourceType: 'chat' });
      component.handleClick();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
