import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PostulacionPage } from './postulacion.page';

describe('PostulacionPage', () => {
  let component: PostulacionPage;
  let fixture: ComponentFixture<PostulacionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PostulacionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
