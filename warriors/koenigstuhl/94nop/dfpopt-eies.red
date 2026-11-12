;redcode-94nop
;name Dried Frog Pills A eies
;author Steve Gunnell
;strategy Q4 -> Newtish Stone / Imp
;assert CORESIZE==8000


QFAC  equ  4633
QINV  equ  297
dat0  equ  (t2 - 20 )
GAP1  equ  12
GAP2  equ  11
GAP3  equ  1
GAP4  equ  0
GAP5  equ  0
BTIME equ  17
START equ  3694
HOP	equ	(3+hit-gate1)

gate1   equ     (init-7-dist)
pat     equ     4415
ival    equ     (START-702)
dist    equ     3

impy    equ     (imp+sep)
sep     equ     7281
st      equ     2667

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

bgo     MOV.I   cbomb,  @sptr
        MOV.I   <spos,  {sptr
        SPL.B   iboot,  <-300
for 6
        MOV.I   <spos,  {sptr
rof

        SPL.B   *sptr,  <-200

sptr    DIV.F   #init+START,     #init+START-7-3

cbomb   dat	{1143	,HOP
; 2 DATS
init    SPL.B   #0,     <stone-pat
stone   SPL.B   #pat,   <-pat
loop    MOV.I   {0+pat, hit-pat
        ADD.F   stone,  loop
hit     DJN.F   loop,   <stone-pat
        MOV.I   init-dist, >gate1
last    DJN.F   -1,     >gate1

spos    DAT.F   $0,     $0

      for GAP4
      dat.f  $0       ,$0
      rof

;;--------------------- Boot the imp/launch -------------------------

iboot   MOV.I   <ipos,  {iptr
for 4
        MOV.I   <ipos,  <iptr
rof
        SPL.B   @iptr,  <-300

iptr    DIV.F   #init+ival+sep+1,       #init+ival
datone  DAT.F   }300,   >200

spin    SPL.B   #st+1,  >prime
prime   MOV.I   impy,   impy
        ADD.F   spin,   jump
jump    JMP.B   impy-st-1, <-535
imp     MOV.I   #st,    *0

ipos    DAT.F   $0,     $0

      for GAP5
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

decod
q0    mul.b  *2       ,qb
decid sne    {t1      ,@qb
q1    add.b  t2       ,qb
      add.ba *t3      ,qb
      mov    qdat     ,*qb
      mov    qdat     ,@qb
qb    mov    24       ,*D
      sub    qsub     ,qb
      djn    -4       ,#BTIME
      jmp    bgo
qsub  dat    -15      ,21
qdat  dat    10       ,0


      end    qscan

