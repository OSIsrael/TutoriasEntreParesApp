import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TutorAsistenciaPage } from './tutor-asistencia.page';

describe('TutorAsistenciaPage', () => {
  let component: TutorAsistenciaPage;
  let fixture: ComponentFixture<TutorAsistenciaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorAsistenciaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
