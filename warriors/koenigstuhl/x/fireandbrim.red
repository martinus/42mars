;redcode-94x
;name Fire and Brimstone
;author David Moore/Steve Gunnell
;strategy anti-imp scanner or stone with airbag
;strategy Replaced The Truth Is Out There II with Kenshin.
;assert CORESIZE==55440

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

pState equ 123

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
;   Kenshin                     ;
;                               ;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

STEP  equ  15331
START equ  51541
LEAP  equ  (head+32003)
bptr  equ  (head-2)

sBoot spl    LEAP     ,head
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      mov.i  >sBoot   ,}sBoot
      sub.f  sBoot    ,sBoot
      dat.f  0        ,0


head  slt    #START   ,#tail-bptr+5
      mov.a  head     ,bptr
trash mov    *tail    ,}bptr
      add.a  #STEP    ,@hptr
      jmz.f  trash    ,*head
hptr  jmn.a  @hptr   ,head
      jmp    @hptr   ,}tail
tail  spl    #0       ,}0
      jmp #0, }0
      dat  0, 0

end start

