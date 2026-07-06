import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, schoolOutline, timeOutline, personOutline, megaphoneOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel]
})
export class TabsPage {
  constructor() {
    // 🌟 Agregamos personOutline a la lista de íconos permitidos
    addIcons({calendarOutline,megaphoneOutline,timeOutline,personOutline,schoolOutline});
  }
}