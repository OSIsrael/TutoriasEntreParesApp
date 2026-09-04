import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonItem,  IonInput, 
  IonSelect, IonSelectOption, IonButton, IonSpinner, IonList, IonIcon,ToastController,AlertController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, arrowBackOutline,checkmarkCircleOutline,warningOutline } from 'ionicons/icons'; 
import { DatabaseService } from '../../services/database';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonItem, 
     IonInput, IonSelect, IonSelectOption, 
    IonButton, IonSpinner, IonList, IonIcon
  ]
})
export class LoginPage implements OnInit {
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private firestore = inject(Firestore); 
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  modoRegistro = false;
  cargando = false;
  
  correoGoogle: string = ''; 
  correoInstitucional: string = ''; 
  
  nombreCompleto: string = '';
  sede: string = '';       
  cedula: string = '';
  ciclo: string = '';
  beca: string = '';
  celular: string = '';

  carreraSeleccionada: string = '';
  busquedaCarrera: string = '';
  listaCarrerasMaster: string[] = [];
  carrerasFiltradas: string[] = [];

  // ==========================================
  // 🌟 GETTERS DE VALIDACIÓN EN TIEMPO REAL
  // ==========================================
  get estadoCorreo(): { texto: string, color: string } | null {
    if (!this.correoInstitucional) return null; 
    const correoLimpio = this.correoInstitucional.toLowerCase().trim();
    if (correoLimpio.endsWith('@est.ups.edu.ec') || correoLimpio.endsWith('@ups.edu.ec')) {
      return { texto: 'Correo válido', color: 'exito' };
    }
    return { texto: 'Debe terminar en @est.ups.edu.ec o @ups.edu.ec', color: 'error' };
  }

  get estadoNombre(): { texto: string, color: string } | null {
    if (!this.nombreCompleto) return null;
    const val = this.validarNombreCompleto(this.nombreCompleto);
    if (val.valido) return { texto: 'Nombre correcto', color: 'exito' };
    return { texto: val.mensaje, color: 'error' };
  }

  get estadoCedula(): { texto: string, color: string } | null {
    if (!this.cedula) return null;
    const val = this.validarDocumento(this.cedula);
    if (val.valido) return { texto: val.mensaje, color: 'exito' };
    return { texto: val.mensaje, color: 'error' };
  }

  get estadoCelular(): { texto: string, color: string } | null {
    if (!this.celular) return null;
    if (this.validarCelular(this.celular)) return { texto: 'Número celular válido', color: 'exito' };
    return { texto: 'Debe tener 10 dígitos y empezar con 09', color: 'error' };
  }

  get estadoCarrera(): { texto: string, color: string } | null {
    if (!this.busquedaCarrera) return null;
    if (this.carreraSeleccionada && this.carreraSeleccionada === this.busquedaCarrera) {
      return { texto: 'Carrera seleccionada correctamente', color: 'exito' };
    }
    return { texto: 'Toca una carrera de la lista desplegable', color: 'error' };
  }

  constructor() {
    addIcons({ logoGoogle, arrowBackOutline,checkmarkCircleOutline,warningOutline }); 
  }

  async ngOnInit() {
    const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
    this.listaCarrerasMaster = catalogos.carreras || [];
  }

  ionViewWillEnter() {
    this.modoRegistro = false;
    this.cargando = false;
    this.correoGoogle = '';
    this.correoInstitucional = '';
    this.nombreCompleto = '';
    this.sede = '';
    this.cedula = '';
    this.carreraSeleccionada = '';
    this.busquedaCarrera = '';
    this.ciclo = '';
    this.beca = '';
    this.celular = '';
    this.carrerasFiltradas = [];
  }

  // ==========================================
  // 🌟 LÓGICA DE VALIDACIÓN (CÉDULA / PASAPORTE)
  // ==========================================
  validarDocumento(docId: string): { valido: boolean, mensaje: string } {
    if (!docId) return { valido: false, mensaje: 'El documento está vacío.' };
    const docLimpio = docId.trim().toUpperCase();

    // 1. Si el usuario escribe exactamente 10 números, asumimos que es Cédula y aplicamos tu fórmula
    if (/^[0-9]{10}$/.test(docLimpio)) {
      if (this.validarCedulaLogica(docLimpio)) {
        return { valido: true, mensaje: 'Cédula ecuatoriana válida' };
      } else {
        return { valido: false, mensaje: 'Cédula incorrecta (no pasa validación de registro civil)' };
      }
    }

    // 2. Si tiene letras o una longitud distinta (entre 6 y 15 caracteres), lo validamos como Pasaporte
    const regexPasaporte = /^[A-Z0-9]{6,15}$/;
    if (regexPasaporte.test(docLimpio)) {
      return { valido: true, mensaje: 'Pasaporte válido' };
    }

    // 3. Si no cumple ninguna de las dos reglas
    return { valido: false, mensaje: 'Ingrese una cédula (10 números) o pasaporte (6-15 caracteres alfanuméricos)' };
  }

  // Tu fórmula matemática para la cédula (ahora actúa en segundo plano)
  validarCedulaLogica(cedula: string): boolean {
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;
    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito > 5) return false; 
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let digito = parseInt(cedula.charAt(i), 10);
      if (i % 2 === 0) { digito = digito * 2; if (digito > 9) digito -= 9; }
      suma += digito;
    }
    const decenaSuperior = Math.ceil(suma / 10) * 10;
    let digitoVerificador = decenaSuperior - suma;
    if (digitoVerificador === 10) digitoVerificador = 0;
    return digitoVerificador === parseInt(cedula.charAt(9), 10);
  }

  validarCelular(celular: string): boolean {
    return celular.length === 10 && celular.startsWith('09');
  }

  // 🌟 PUNTO 3: FILTRO ESTRICTO (DOS NOMBRES Y DOS APELLIDOS)
  validarNombreCompleto(nombre: string): { valido: boolean, mensaje: string, nombreLimpio: string } {
    if (!nombre) return { valido: false, mensaje: "El nombre está vacío.", nombreLimpio: "" };

    const limpio = nombre.trim().replace(/\s+/g, ' ');
    const regexSoloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    
    if (!regexSoloLetras.test(limpio)) {
      return { valido: false, mensaje: "El nombre solo debe contener letras y espacios.", nombreLimpio: limpio };
    }

    const palabras = limpio.split(' ');

    if (palabras.length < 4) {
      return { 
        valido: false, 
        mensaje: "Debes ingresar obligatoriamente dos nombres y dos apellidos.", 
        nombreLimpio: limpio 
      };
    }

    const palabraInvalida = palabras.find(p => p.length < 2);
    if (palabraInvalida) {
      return { 
        valido: false, 
        mensaje: `Has ingresado iniciales ("${palabraInvalida}"). Por favor, escribe tus nombres completos.`, 
        nombreLimpio: limpio 
      };
    }

    return { valido: true, mensaje: "", nombreLimpio: limpio.toUpperCase() }; 
  }

  filtrarCarreras() {
    const txt = this.busquedaCarrera.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { this.carrerasFiltradas = []; return; }
    this.carrerasFiltradas = this.listaCarrerasMaster.filter(c => 
      c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(txt)
    );
  }

  seleccionarCarrera(carrera: string) {
    this.carreraSeleccionada = carrera;
    this.busquedaCarrera = carrera; 
    this.carrerasFiltradas = [];    
  }

  async ingresarConGoogle() {
    this.cargando = true;

    try {
      const proveedor = new GoogleAuthProvider();
      proveedor.setCustomParameters({ prompt: 'select_account' });

      const resultadoAuth = await signInWithPopup(this.auth, proveedor);
      const usuarioGoogle = resultadoAuth.user;

      if (!usuarioGoogle.email) {
        this.mostrarAviso("Error al leer la cuenta de Google.",'error');
        this.cargando = false; return;
      }

      this.correoGoogle = usuarioGoogle.email.toLowerCase().trim();
      
      const respuestaBdd = await this.dbService.verificarUsuarioExistente(this.correoGoogle);

      if (respuestaBdd.existe) {
       this.iniciarSesionLocal(respuestaBdd.datos, respuestaBdd.rol || 'ESTUDIANTE');
      } else {
        this.nombreCompleto = ''; 
        this.modoRegistro = true;
        this.cargando = false;
      }

    } catch (error: any) {
      console.error("Error Auth:", error);
      this.cargando = false;
    }
  }

  async procesarRegistroCompleto() {
    if (!this.correoInstitucional || !this.nombreCompleto || !this.cedula || !this.carreraSeleccionada || !this.ciclo || !this.beca || !this.celular || !this.sede) {
      this.mostrarAviso("Por favor llena todos los campos obligatorios.",'advertencia');
      return;
    }

    const correoLimpio = this.correoInstitucional.toLowerCase().trim();

    if (!correoLimpio.endsWith('@est.ups.edu.ec') && !correoLimpio.endsWith('@ups.edu.ec')) {
      this.mostrarAviso("El correo ingresado no pertenece a la UPS.",'advertencia');
      return;
    }

    // Validación Nombre
    const validacionNombre = this.validarNombreCompleto(this.nombreCompleto);
    if (!validacionNombre.valido) {
      this.mostrarAviso(validacionNombre.mensaje,'info');
      return;
    }
    this.nombreCompleto = validacionNombre.nombreLimpio; 

    // 🌟 NUEVA Validación Cédula/Pasaporte
    const valDoc = this.validarDocumento(this.cedula);
    if (!valDoc.valido) {
      this.mostrarAviso("El documento de identidad ingresado no es válido.", 'error'); 
      return;
    }
    this.cedula = this.cedula.trim().toUpperCase(); // Guardar en mayúsculas

    // Validación Celular
    if (!this.validarCelular(this.celular)) {
      this.mostrarAviso("El número de celular debe empezar con 09 y tener 10 dígitos.",'info'); return;
    }

    this.cargando = true;

    try {
      const estRef = doc(this.firestore, 'Estudiantes', correoLimpio);
      const estSnap = await getDoc(estRef);
      if (estSnap.exists()) {
        this.mostrarAviso(`El correo ${correoLimpio} ya está vinculado a otra cuenta de Google.`,'advertencia');
        this.cargando = false; return;
      }

      const tutRef = doc(this.firestore, 'Tutores', correoLimpio);
      const tutSnap = await getDoc(tutRef);
      if (tutSnap.exists()) {
        const datosTutor = tutSnap.data();
        if (datosTutor['correo_google'] && datosTutor['correo_google'] !== this.correoGoogle) {
          this.mostrarAviso(`Este correo ya fue vinculado a la cuenta: ${datosTutor['correo_google']}.`,'advertencia');
          this.cargando = false; return;
        }
        await updateDoc(tutRef, { correo_google: this.correoGoogle });
        const datosActualizados = tutSnap.data();
        datosActualizados['correo_google'] = this.correoGoogle;
        this.iniciarSesionLocal(datosActualizados, datosActualizados['rol'] || 'TUTOR');
        return;
      }

      const adminRef = doc(this.firestore, 'Administradores', correoLimpio);
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        const datosAdmin = adminSnap.data();
        if (datosAdmin['correo_google'] && datosAdmin['correo_google'] !== this.correoGoogle) {
          this.mostrarAviso(`Este correo ya fue vinculado a la cuenta: ${datosAdmin['correo_google']}.`,'advertencia');
          this.cargando = false; return;
        }
        await updateDoc(adminRef, { correo_google: this.correoGoogle });
        const datosActualizados = adminSnap.data();
        datosActualizados['correo_google'] = this.correoGoogle;
        this.iniciarSesionLocal(datosActualizados, datosActualizados['rol'] || 'ADMIN');
        return;
      }

    } catch(e) { 
      console.error("Error al verificar unicidad:", e); 
      this.mostrarAviso("Hubo un problema verificando tu correo. Inténtalo de nuevo.",'error');
      this.cargando = false; return;
    }

    const nuevoEstudiante = {
      correo_google: this.correoGoogle,    
      correo: correoLimpio,                
      nombre_completo: this.nombreCompleto, 
      cedula: this.cedula, // Ya validado como cédula o pasaporte
      sede: this.sede,               
      carrera: this.carreraSeleccionada, 
      ciclo: this.ciclo,
      beca: this.beca,
      celular: this.celular,
      estado: 'ACTIVO',
      rol: 'ESTUDIANTE',
      fecha_registro: new Date().toISOString()
    };

    await this.dbService.registrarNuevoEstudiante(nuevoEstudiante);
    this.iniciarSesionLocal(nuevoEstudiante, 'ESTUDIANTE');
  }

  iniciarSesionLocal(datos: any, rol: string) {
    localStorage.setItem('correo', datos.correo); 
    localStorage.setItem('nombre', datos.nombre_completo || datos.nombre);
    localStorage.setItem('rol', rol);
    localStorage.setItem('sede', datos.sede || 'CUENCA'); 
    localStorage.setItem('carrera', datos.carrera || ''); 
    localStorage.setItem('ciclo', datos.ciclo);
    localStorage.setItem('cedula', datos.cedula);
    localStorage.setItem('celular', datos.celular);
    this.cargando = false;
    this.router.navigate(['/tabs/horarios']);
  }

  // ==========================================
  // 🌟 SISTEMA DE AVISOS NATIVOS PREMIUM
  // ==========================================
  async mostrarAviso(mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info' = 'exito') {
    let icono = 'checkmark-circle-outline';
    let claseCss = 'toast-exito';

    if (tipo === 'error') {
      icono = 'close-circle-outline';
      claseCss = 'toast-error';
    } else if (tipo === 'advertencia') {
      icono = 'warning-outline';
      claseCss = 'toast-advertencia';
    } else if (tipo === 'info') {
      icono = 'information-circle-outline';
      claseCss = 'toast-info';
    }

    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top', 
      icon: icono,
      cssClass: `toast-premium-gietaes ${claseCss}`,
      mode: 'ios' 
    });
    await toast.present();
  }

  async confirmarAccion(cabecera: string, mensaje: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: cabecera,
        message: mensaje,
        cssClass: 'alerta-premium-gietaes',
        mode: 'md', 
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'btn-alerta-cancelar',
            handler: () => resolve(false)
          },
          {
            text: 'Sí, Continuar',
            cssClass: 'btn-alerta-confirmar',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }
}