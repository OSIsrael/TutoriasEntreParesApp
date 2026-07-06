import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisTutoriasPage } from './mis-tutorias.page';

describe('MisTutoriasPage', () => {
  let component: MisTutoriasPage;
  let fixture: ComponentFixture<MisTutoriasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MisTutoriasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
