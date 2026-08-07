import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tutor-estadisticas',
  templateUrl: './tutor-estadisticas.page.html',
  styleUrls: ['./tutor-estadisticas.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class TutorEstadisticasPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
