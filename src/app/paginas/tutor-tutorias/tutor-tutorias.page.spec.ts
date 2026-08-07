import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TutorTutoriasPage } from './tutor-tutorias.page';

describe('TutorTutoriasPage', () => {
  let component: TutorTutoriasPage;
  let fixture: ComponentFixture<TutorTutoriasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorTutoriasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
