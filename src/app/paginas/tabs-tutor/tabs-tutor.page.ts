import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs-tutor',
  templateUrl: './tabs-tutor.page.html',
  styleUrls: ['./tabs-tutor.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class TabsTutorPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
