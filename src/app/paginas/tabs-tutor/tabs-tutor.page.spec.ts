import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabsTutorPage } from './tabs-tutor.page';

describe('TabsTutorPage', () => {
  let component: TabsTutorPage;
  let fixture: ComponentFixture<TabsTutorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsTutorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
