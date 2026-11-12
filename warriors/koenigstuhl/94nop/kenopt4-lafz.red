;redcode-94nop
;name Kenshin D lafz
;author Steve Gunnell
;strategy Qscan -> f-scanner with inloop bombing.
;assert CORESIZE==8000


STEP  equ  7449
QFAC  equ  837
QINV  equ  5773
START equ  7458
LEAP  equ  (head+2427)
bptr  equ  (head-2)
dat0  equ  (t2 - 20 )

GAP1  equ  0
GAP2  equ  0
GAP3  equ  0
GAP4  equ  30
GAP5  equ  9

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

bgo   spl    2        ,>4000
boot  spl    LEAP     ,head
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      mov.i  >boot    ,}boot
      sub.f  boot     ,boot
      dat.f  >0       ,>4000

      for GAP4
      dat.f  $0       ,$0
      rof

head  slt    #START   ,#tail-bptr+5
      mov.a  head     ,bptr
trash mov    tail     ,}bptr
      add.a  #STEP    ,@hptr
      jmz.f  trash    ,*head
hptr  jmn.a  @hptr   ,head
      jmp    @hptr   ,}trash
tail  spl #0, {0
      jmp #0, {0
      mod.f >0, <0

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


BZ    equ    11

decod
q0    mul.b  *2       ,qb
decid sne    {t1      ,@qb
q1    add.b  t2       ,qb
      add.ba *t3      ,qb
      mov    qdat     ,*qb
      mov    qdat     ,@qb
qb    mov    BZ+BZ    ,*D
      sub    qsub     ,qb
      djn    -4       ,#6
      jmp    bgo
qsub  dat    -BZ      ,BZ+BZ
qdat  dat    BZ       ,0

      end    qscan

