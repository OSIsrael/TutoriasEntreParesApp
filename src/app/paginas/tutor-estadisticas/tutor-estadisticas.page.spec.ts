import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TutorEstadisticasPage } from './tutor-estadisticas.page';

describe('TutorEstadisticasPage', () => {
  let component: TutorEstadisticasPage;
  let fixture: ComponentFixture<TutorEstadisticasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorEstadisticasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
