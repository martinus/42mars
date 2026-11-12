;redcode-odd
;name Studie 10/4
;author Sascha Zapf
;strategy 0.80c sne/seq-one-shot
;assert CORESIZE==8000

dsstart EQU   7755  ; Start des DJN-Stream im Scanner
csstart EQU   7264  ; Start des DJN-Stream im Coreclear
dstart  EQU   117   ; Erste Position der der neuen CC-Runde
decoy EQU tpos+1
tpos EQU dab-11
sstep  EQU 23
sgap EQU 11
fposa EQU 549
fposb EQU fposa-sgap

dab dat.f <csstart,<dstart
spb spl #csstart,<dstart

for 6
 dat 0, 0
rof

ssd spl #0, <dsstart
 mov.i @bpos,}tpos
 mov.i @bpos,>tpos
bpos djn.f -2,{spb

for 10-5
 dat 0,0
rof

inkr dat.f      #sstep, #sstep ; Hier beginnt der 2-Phasen Coreclear

;*******<-Stepb: Den Scanner jetzt etwas langsamer gemacht: 9185 Pts

loop add.f inkr, scan
start ;sne.x    }scan, >scan
 ;add.f inkr, scan
scan sne.x      fposa, fposb
 djn.f loop, <dsstart
      mov.f scan, tpos
 add.ab #10, tpos       ; Zeiger korrigieren, später optimieren 50! 20!
 jmp ssd

;*******->Ok, und fertig ist ein ordentlich optimierter Krieger ;-)


for 26+5+2
dat 0, 0
rof

;*******<-Step4a:Ok, das ganze nun mit einem qscanner und etwas Anpassung
daran
;*******->ergibt: 9097 Pts
org qGo

qf equ qKil
qs equ 200
qd equ 4000
qi equ 7
qr equ 8

qBmb dat   {qi*qr-10, {1
qGo  seq   qd+qf+qs, qf+qs
jmp   qSki, {qd+qf+qs+qi+2
sne   qd+qf+5*qs, qf+5*qs
seq   qf+4*qs, {qTab
jmp   qFas, }qTab
sne   qd+qf+8*qs, qf+8*qs
seq   qf+7*qs, {qTab-1
jmp   qFas, {qFas
sne   qd+qf+10*qs, qf+10*qs
seq   qf+9*qs, {qTab+1
jmp   qFas, }qFas
seq  qd+qf+2*qs, qf+2*qs
jmp   qFas, {qTab
seq   qd+qf+6*qs, qf+6*qs
djn.a qFas, {qFas
seq   qd+qf+3*qs, qf+3*qs
jmp   qFas, {qd+qf+3*qs+qi+2
sne   qd+qf+14*qs, qf+14*qs
seq   qf+13*qs, <qTab
jmp   qSlo, >qTab
sne   qd+qf+17*qs, qf+17*qs
seq   qf+16*qs, <qTab-1
jmp   qSlo, {qSlo
seq   qd+qf+11*qs, qf+11*qs
jmp   qSlo, <qTab
seq   qd+qf+15*qs, qf+15*qs
djn.b qSlo, {qSlo
sne   qd+qf+12*qs, qf+12*qs
jmz   start, qd+qf+12*qs-qi
qSlo  mov.ba qTab, qTab
qFas  mul.ab qTab, qKil
qSki  sne   qBmb-1, @qKil
      add   #qd, qKil
qLoo  mov.i qBmb, @qKil
qKil  mov.i  qBmb, *qs
      sub.ab #qi, qKil
      djn    qLoo, #qr
      jmp    scan, <-4000
      dat   5408, 7217
qTab  dat   4804, 6613
dSrc  dat   5810, qBmb-5

end
