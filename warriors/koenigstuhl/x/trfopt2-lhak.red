;redcode-94x
;name Trefoil HX 11
;author Steve Gunnell
;strategy p-space, Kenshin, a paper and a simple stone
;assert 1

STEP1   equ  47263
STEP2   equ  8354
STEP3   equ  51571
MARK    equ  27625

SSTEP   equ  50443
SOFF    equ  32622

DSTEP   equ  (4483*12)
DOFF    equ  36055

IMPNUM  equ  45137 ; 24

GAP     equ  7

;;;;;;;;;;;;;;;;;;;;
;                  ;
;    paper         ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

paper:
       spl  1, <MARK ;
	   mov -1,0 ;
	   mov -1,0 ; 5 ; 5
       spl    @0    ,{STEP1
	   mov.i  }-1   ,>-1
	   mov.i  }-2 , >-2
	   mov.i  }-3 , >-3 ; 14
loop1:
       spl    @0    ,STEP2
	   mov.i  }-1   ,>-1
	   mov.i  }-2  ,>-2 ; 5
	   mov.i  bomb1, }MARK
       mov.i {loop1,<2
	   mov.i {loop1,<1
	   djn.f   @0,<IMPNUM+1 ; 22
bomb1:
       dat {IMPNUM+IMPNUM+1, >IMPNUM+IMPNUM+1 ; 74

   for GAP
       dat.f $0, $0
   rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;     scanner      ;
;                  ;
;;;;;;;;;;;;;;;;;;;;


bptr  equ  head-3

head  slt    #SSTEP   ,#tail+5
      mov.a  head     ,bptr
trash mov    tail     ,}bptr
      add.a  #SSTEP   ,@hptr
      jmz.f  trash    ,*head
hptr  jmn.a  @hptr    ,head
      jmp    @hptr    ,}trash
tail  spl    #0       ,{0
      div.x <0, >0

   for GAP
      dat 0,0
   rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;    stone         ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

stone   SPL.B   #DSTEP,	-DSTEP
loop	ADD.F   stone,  dbomb
        MOV.I   dbomb,  * dbomb
        MOV.I   dbomb,  @ dbomb
        JMP.F   loop,   dbomb
dbomb   dat.f   #6,     #0

   for GAP
      dat 0,0
   rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;  pspace & boot   ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

PKEY    equ  141

table   nop  2  , w0
        nop  0  , w2
        nop  1  , w1
        nop  2  , w0
        nop  1  , w1

   for 5
      dat 0,0
   rof

w0      dat   DOFF, #stone-last+length
w1      dat   SOFF, #head-last+length
w2      dat   0   , #paper-last

length  equ    9
states  equ    5

       dat    0,          table-state
tlink  dat    0,          table-state
       dat    0,          table-state+1
       dat    0,          table-state+2

   for GAP
      dat 0,0
   rof

think  ldp.a  #0,         tlink
load   ldp.a  #PKEY,      state
       mod.a  #states,    state
       add.ba *tlink,     state
store  stp.ab *state,     #PKEY
state  mov.f  @0,         last
       jmz.a  @last,      last

       for length
       mov.i  <last, {last
       rof

last  djn.f 0, 0  ; this line will be modified

end think
