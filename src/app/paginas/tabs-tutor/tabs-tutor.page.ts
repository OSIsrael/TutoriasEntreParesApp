import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, checkboxOutline, megaphoneOutline, personOutline} from 'ionicons/icons';

@Component({
  selector: 'app-tabs-tutor',
  templateUrl: './tabs-tutor.page.html',
  styleUrls: ['./tabs-tutor.page.scss'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel]
})
export class TabsTutorPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor() {
    addIcons({ calendarOutline, checkboxOutline, megaphoneOutline,personOutline });
  }
}