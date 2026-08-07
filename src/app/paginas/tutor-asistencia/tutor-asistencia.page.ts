import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tutor-asistencia',
  templateUrl: './tutor-asistencia.page.html',
  styleUrls: ['./tutor-asistencia.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class TutorAsistenciaPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
