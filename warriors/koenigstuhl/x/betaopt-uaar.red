;redcode-94x
;name Dettol AX 28
;author Steve Gunnell
;strategy Betadine derivative
;assert 1

STEP   equ 14296
COUNT  equ 3706
SPACE  equ 154
GAP1   equ 2
GAP2   equ 12
REPEAT equ 2
DECOY  equ 1185
AV     equ 87
RP2    equ 7
RP3    equ 6
BEGIN  equ (scn-STEP*COUNT)

gate     dat   BEGIN  ,BEGIN-SPACE
     for  GAP1
         dat.f $0    ,$0
     rof
     for  RP2
         dat.f $0    ,$0
     rof
         dat   #-AV   ,bot+3-gate
clr      spl   #-AV   ,bot+3-gate
bom      mov   @bot  ,>gate
     for  REPEAT
         mov   @bot  ,>gate
     rof
bot      djn.f bom    ,{clr
     for  GAP2
         dat.f $0    ,$0
     rof
in1      dat   STEP   ,STEP
lp1      add   in1     ,gate
scn      sne   @gate ,*gate
     for  RP3
         add   in1     ,gate
         sne   @gate ,*gate
     rof
         djn.f lp1    ,<DECOY
         jmp   clr    ,<gate

     end  scn
