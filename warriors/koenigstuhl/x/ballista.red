;redcode-94x
;name Ballista
;author Christian Schmidt
;strategy p-warrior, Arrow X and a stone
;assert 1

org start

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;                           ;
;   airbag stone + dclear   ;
;                           ;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

dDist  equ (dBoot+43990)
dGate  equ    -5
dStep  equ 53421  ;dStep % 3 == 0
dbPos  equ    11

dBoot  spl  dBoot2, >dDist+(dPtr-dTop)+dStep*1030
       spl       1, >dDist+(dPtr-dTop)+dStep*1033
       mov.i    {0, #0
       mov   {dSpl, <dAway1
       mov   {dSpl, <dAway2
       jmp }dAway1, >dBoot2
dAway1 dat dDist+1,  dDist+(dLast-dTop)+1

       dat 0, 0
       dat 0, 0

dDat   dat <27721, 5-dGate

dSpl   spl     #dLast+1, {dSpl+dGate+2
       mov dSpl+dGate+1, >dSpl+dGate
       djn.f         -1, >dSpl+dGate

dTop   add.ab #dStep*2, dPtr
       mov      >2,    @dPtr
dPtr   mov      <1,    *(dStep*2)
       jmn.b  dTop,     dTop+dbPos
dLast  jmp dPtr+dStep, <dGate-1

dBomb  mov dStep, 1

       dat 0, 0
       dat 0, 0

dBoot2 mov   dBomb,  dDist+dbPos
       spl       1, {dDist+(dPtr-dTop)+dStep*1036
       mov   {dSpl, <dAway1
dAway2 mov    dDat, <dDist+(dPtr-dTop)+dStep+3
       jmp >dAway1, <dAway2

  for 71
    dat 0,0
  rof

;;;;;;;;;;;;;;;
;             ;
;   P-Brain   ;
;             ;
;;;;;;;;;;;;;;;

pState equ 2001

start  ldp.a      #0,  pTab2
       ldp.a #pState,  pTable
       mod.ba *pTab2,  pTable
       stp.b *pTable, #pState
pTable jmp     }0, 155 ;= (22*7)+1 = (25*6)+5 = (31*5)+0
       spl #sBoot, 156 ;= (22*7)+2 = (26*6)+0 = (31*5)+1
       spl #sBoot,  37 ;= ( 5*7)+2 = ( 6*6)+1 = ( 7*5)+2
       spl #dBoot,  94 ;= (13*7)+3 = (15*6)+4 = (18*5)+4
       spl #dBoot,  59 ;= ( 8*7)+3 = ( 9*6)+5 = (11*5)+4
       spl #dBoot, 150 ;= (21*7)+3 = (25*6)+0 = (30*5)+0
       jmp #dBoot, 180 ;= (25*7)+5 = (30*6)+0 = (36*5)+0

       dat 0, 0
       dat 0, 0
       spl #1, 1

pTab2  spl #0, 6
       spl #0, 7
       spl #0, 5

  for 56
    dat 0,0
  rof

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;                               ;
;           Arrow X             ;
;                               ;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

sDist   equ    18008;19241
sStep   equ    4927
sHit    equ    45
sTrain  equ    50302
cGate   equ    (sHead-2)

sHead   mov    }sFlag,     >1800
sWip    mov    *sAdd,      >sHead
sAdd    add.f  step,       sScan
sScan   sne    }2*sStep+8, 2*sStep
sFlag   djn.f  sAdd,       <sTrain
        mov.b  sScan,      @sWip
        djn    {sFlag,     #sHit
step    spl    #sStep,     sStep
cLoo    mov    cBmb,       >cGate
        djn.f  cLoo,       >cGate
cBmb    dat    <1,         2-cGate
        dat    0,          0


sBoot  mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
sAway  spl start+sDist, cBmb+1
       mov <sAway, {sAway
       mov <sAway, {sAway
       mov <sAway, {sAway
       mod.ab sAway, sAway

end

