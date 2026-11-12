;redcode-94
;name PM do Rio
;author Leonardo H. Liporati
;strategy Q^3
;strategy if Something found -> save it inside a mini-HSA
;strategy else -> Die Hard
;assert CORESIZE==8000
; KOFACOTO 4

     org qGo

     qf equ qKil
     qs equ 200
     qd equ 4000
     qi equ 3
     qr equ 22
ciaboot equ 2500
  fixup equ 24

     dat 0,0

qBmb jmp   -(ciaboot+fixup)+pit-qKil
     jmp   ciaboot+fixup
jp1  jmp   qi, (2*qi)

;    -+)>] 0/1 cycles [(<+-

qGo  seq   qd+qf+qs,    qf+qs      ; 1
     jmp   qSki,        {qd+qf+qs+qi+2

     sne   qd+qf+5*qs,  qf+5*qs    ; B+1
     seq   qf+4*qs,     {qTab      ; B
     jmp   qFas,        }qTab

     sne   qd+qf+8*qs,  qf+8*qs    ; A
     seq   qf+7*qs,     {qTab-1    ; A-1
     jmp   qFas,        {qFas

     sne   qd+qf+10*qs, qf+10*qs   ; C
     seq   qf+9*qs,     {qTab+1    ; C-1
     jmp   qFas,        }qFas

     seq   qd+qf+2*qs,  qf+2*qs    ; B-2
     jmp   qFas,        {qTab

     seq   qd+qf+6*qs,  qf+6*qs    ; A-2
     djn.a qFas,        {qFas

     seq   qd+qf+3*qs,  qf+3*qs    ; B-1
     jmp   qFas,        {qd+qf+3*qs+qi+2

;    -+>)] 2 cycles [(<+-

     sne   qd+qf+14*qs, qf+14*qs   ; E+1
     seq   qf+13*qs,    <qTab      ; E
     jmp   qSlo,        >qTab

     sne   qd+qf+17*qs, qf+17*qs   ; D
     seq   qf+16*qs,    <qTab-1    ; D-1
     jmp   qSlo,        {qSlo

     sne   qd+qf+19*qs, qf+19*qs   ; F
     seq   qf+18*qs,    <qTab+1    ; F-1
     jmp   qSlo,        }qSlo

     seq   qd+qf+11*qs, qf+11*qs   ; E-2
     jmp   qSlo,        <qTab

     seq   qd+qf+15*qs, qf+15*qs   ; D-2
     djn.b qSlo,        {qSlo

     sne   qd+qf+12*qs, qf+12*qs   ; E-1
     jmz   pGo, qd+qf+12*qs-qi     ; Free Scan ;-)

qSlo mov.ba qTab, qTab
qFas mul.a  qTab, qKil
qSki sne.i  qBmb-1, *qKil
     add.a  #qd,   qKil

     sub.a  qKil,  qBmb

     add.ab qKil,  qKil
     mov.i  qBmb+1, *qKil
     mov.i  qBmb  , @qKil

qLoo sub.f  jp1, qKil

     mov.i  jp1  ,  *qKil
     mov.i  jp1  ,  @qKil
qKil mov.i  qs   ,  *ciaboot+fixup

     djn    qLoo, #qr
     jmp    scan
                            ;  (mod 8000)
     dat   5408, 7217       ; A*qs =  8*qs ,D*qs = 17*qs
qTab dat   4804, 6613       ; B*qs =  4*qs ,E*qs = 13*qs
     dat   5810, 7619       ; C*qs = 10*qs ,F*qs = 19*qs

     for 12
              dat   0,0
     rof

; mini-HSA

SELFS   equ    16  ; 17
INCR    equ    9   ; 7

ptr     equ    (bomb-4)

bomb    spl    #1          , }1
pit     jmp    #0          , 0
wipe    mov    bomb        , {ptr
        mov    }ptr        , }ptr
pptr    jmn.f  wipe        , }ptr
scan    add.a  #INCR+1     , @pptr
        jmz.f  scan        , {ptr
        slt.ab @pptr       , #boot-ptr+2
        jmp    wipe        , {ptr
        djn    scan        , #SELFS
        jmp    scan        , {wipe

boot    dat 0, 0
for  11
        dat 0, 0
rof

; Die Hard
space    equ (4-40*127)
dv       equ (c0+58)

pGo      spl imp, }-2200
         spl 2,   }-2100
         spl 1,   }-2000
         spl 1,   }-1900

c0       spl   @0,space
         mov   }c0,>c0
cs       spl   #0        ,}dv
         mov   dv        ,}dv+space
cb       add.a #119      , dv+space
         spl   imp+5334  ,}dv+space
         spl   imp+2667  ,}dv+space

imp      mov.i #2667 ,*0

     end

