import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForwardCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule]
})
export class SplashPage {
  private router = inject(Router);

  constructor() {
    addIcons({ arrowForwardCircleOutline });
  }

  irAlLogin() {
    this.router.navigate(['/login']);
  }
}