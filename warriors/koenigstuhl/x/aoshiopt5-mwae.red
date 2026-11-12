;redcode-94x
;name Aoshi E 95
;author Steve Gunnell
;strategy Fast f-scanner with Q^4 scan cribbed from CW 84.
;assert 1

STEP equ 42593
GAP5 equ 0
GAP6 equ 4
BPTR equ (top-GAP5-2)
SPAN equ 18
TIME equ 46
LEAP  equ  (sptr+32983)

QFAC  equ  181
QINV  equ  37981
dat0  equ  (t2 - 20 )

GAP1  equ  0
GAP2  equ  17
GAP3  equ  1
GAP4  equ  3

START equ  40303
IMPNUM equ  23

D     equ  (QINV+1)
A1    equ  (1 + QFAC * (t1-1 - qb) )
A2    equ  (1 + QFAC * (t1   - qb) )
B1    equ  (1 + QFAC * (t2-1 - qb) )
B2    equ  (1 + QFAC * (t2   - qb) )
B3    equ  (1 + QFAC * (t2+1 - qb) )
C2    equ  (1 + QFAC * (t3   - qb) )

      dat.f  0        ,B1
t2    dat.f  0        ,B2
      dat.f  0        ,B3
      for GAP1
      dat.f  $0       ,$0
      rof

      dat.f  dat0     ,A1
t1    dat.f  dat0     ,A2
      for GAP2
      dat.f  $0       ,$0
      rof

t3    dat.f  qb       ,C2
      for GAP3
      dat.f  $0       ,$0
      rof

bgo   mov.i  >boot    ,}boot
      add.a  #GAP5    ,boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
for GAP6
      mov.i  >boot    ,}boot
rof
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      spl    2        ,>4000
boot  spl    LEAP     ,top
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      sub.f  boot     ,boot

top  dat    #START,START+SPAN
sptr mov.b  @tptr ,BPTR
wipe mov.i  bomb  ,>BPTR
for GAP6
     mov.i  *wipe ,>BPTR
rof
     jmn.f  wipe  ,@BPTR
scan add.f  incr  ,@tptr
     jmn.f  safe  ,@top-GAP5
tptr jmz.f  scan  ,*top-GAP5
     mov.x  @tptr ,@tptr
safe slt.b  @tptr ,#tail-top+GAP5+3
     jmp    sptr
     djn.b  scan  ,#TIME
     jmp    scan  ,}wipe
incr dat    STEP  ,STEP
bomb spl #0, {0
tail dat.f  $0       ,$0

      for GAP4
      dat.f  $0       ,$0
      rof

qscan seq    qb+D     ,qb+D+B2
      jmp    decid

      sne    qb+D*C2  ,qb+D*C2+B2
      seq    <t3      ,qb+D*(C2-1)+B2
      jmp    decod    ,}q0

      sne    qb+D*A1  ,qb+D*A1+B2
      seq    <t1-1    ,qb+D*(A1-1)+B2
      djn.a  decod    ,{q0

      sne    qb+D*A2  ,qb+D*A2+B2
      seq    <t1      ,qb+D*(A2-1)+B2
      jmp    decod    ,{q0

      sne    qb+D*B1  ,qb+D*B1+B1
      seq    <t2-1    ,qb+D*(B1-1)+B1-1
      jmp    decod    ,{q1

      seq    qb+D*(B1-2) ,qb+D*(B1-2)+(B1-2)
      djn    decod    ,{q1

      sne    qb+D*B3  ,qb+D*B3+B3
      seq    <t2+1    ,qb+D*(B3-1)+B3-1
      jmp    decod    ,}q1

      sne    qb+D*B2  ,qb+D*B2+B2
      seq    <t3      ,qb+D*(C2-1)+B2
      jmp    decod    
      jmp    bgo

BZ    equ    5

decod
q0    mul.b  *2       ,qb
decid sne    {t1      ,@qb
q1    add.b  t2       ,qb
      add.ba *t3      ,qb
      mov    qdat     ,*qb
      mov    qdat     ,@qb
qb    mov    BZ+BZ    ,*D
      sub    qsub     ,qb
      djn    -4       ,#9
      jmp    bgo
qsub  dat    -BZ      ,BZ+BZ
qdat  dat    BZ       ,0

      end    qscan
