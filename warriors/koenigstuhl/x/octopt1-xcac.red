;redcode-94x
;name Octavo BX 3
;author Steve Gunnell
;strategy 8 process paper with a stone
;assert 1

STEP1  equ  (3553*8)
STEP2  equ  (6406*8)
STEP3  equ  (7872*4)

START  SPL.B  $     1, $     0     
       SPL.B  $     1, $     0     
       SPL.B  $     1, $     0     
       spl    $ stone, $     0
       SPL.B  @     0, # STEP1     
       MOV.I  }    -1, >    -1     
       SPL.B  @     0, # STEP2     
       MOV.I  }    -1, >    -1     
       SPL.B  @     0, # STEP3     
       MOV.I  }    -1, >    -1     
       MOV.I  $     1, >    -2     
BOMB   DJN.I #29180 ,{29180

    for 3
       dat.f       $  0,     $ 0
    rof
    for 33
       dat.f       $  0,     $ 0
       dat.f       $  0,     $ 0
       dat.f       $  0,     $ 0
       dat.f       $  0,     $ 0
    rof
BSTEP  equ  (4994+3)
GATE   equ  (stone-STEP3)
sptr   add.ab #  BSTEP, #BSTEP+1
stone  spl          -1, <   GATE
       mov.i     sbomb, >   sptr
       djn.f     stone, <   GATE
sbomb  dat    #      4, #      4

       end    START
