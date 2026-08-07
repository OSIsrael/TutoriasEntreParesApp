import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, 
  IonIcon, IonBadge, IonList, IonItem 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, notificationsOutline, calendarOutline, 
  documentTextOutline, megaphoneOutline, checkmarkDoneOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.page.html',
  styleUrls: ['./notificaciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
    IonButton, IonButtons, IonIcon, IonBadge, IonList, IonItem
  ]
})
export class NotificacionesPage implements OnInit {
  private dbService = inject(DatabaseService);
  private router = inject(Router);

  notificaciones: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = '';
  sedeUsuario: string = '';

  constructor() {
    addIcons({
      arrowBackOutline, notificationsOutline, calendarOutline, 
      documentTextOutline, megaphoneOutline, checkmarkDoneOutline,
      chevronForwardOutline
    });
  }

  ngOnInit() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'ESTUDIANTE';
    this.sedeUsuario = localStorage.getItem('sede') || 'CUENCA';
  }

  async ionViewWillEnter() {
    this.cargando = true;
    await this.cargarNotificaciones();
    this.cargando = false;
  }

  async cargarNotificaciones() {
    this.notificaciones = await this.dbService.obtenerNotificacionesUsuario(
      this.correoUsuario,
      this.rolUsuario,
      this.sedeUsuario
    );
  }

  esLeida(notif: any): boolean {
    const leidaPor = notif.leida_por || [];
    return leidaPor.includes(this.correoUsuario);
  }

  async seleccionarNotificacion(notif: any) {
    // 1. Marca como leída
    if (!this.esLeida(notif)) {
      await this.dbService.marcarNotificacionLeida(notif.id, this.correoUsuario);
      notif.leida_por = [...(notif.leida_por || []), this.correoUsuario];
    }

    // 2. Redirección inteligente según el tipo
    if (notif.tipo === 'POSTULACION' && (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR')) {
      this.router.navigate(['/admin-postulaciones']);
    } else if (notif.tipo === 'TUTORIA') {
      this.router.navigate(['/tabs/mis-tutorias']);
    } else if (notif.tipo === 'AVISO') {
      this.router.navigate(['/tabs/avisos']);
    }
  }

  regresar() {
    this.router.navigate(['/tabs/horarios']);
  }

  obtenerIcono(tipo: string): string {
    switch (tipo) {
      case 'TUTORIA': return 'calendar-outline';
      case 'POSTULACION': return 'document-text-outline';
      case 'AVISO': return 'megaphone-outline';
      default: return 'notifications-outline';
    }
  }

  formatearFecha(fechaIso: string): string {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    return fecha.toLocaleDateString('es-EC', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  }
}