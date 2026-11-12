;redcode-94x
;name Trefoil FX 19
;author Steve Gunnell
;strategy Custom switcher, Paper, Scanner, Stone.
;assert 1

STEP1   equ  13939
STEP2   equ  6124
STEP3   equ  11371

SSTEP   equ  14263
SOFF    equ  4230

DSTEP   equ  39535
DTIME   equ  33128
DOFF    equ  965

GAP     equ  7

;;;;;;;;;;;;;;;;;;;;
;                  ;
;    paper         ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

paper  spl    1,        <-402
       spl    1,        <-401
       spl    1,        <-400
tpap   spl    @0        ,STEP1
       mov    }-1,       >-1
       spl    @0        ,STEP2
       mov    }-1,       >-1
hpap   spl    @0        ,STEP3
       mov    }-1,       >-1
       mov.i  bpap      ,>hpap
bpap   dat.f <5334  ,<2667

   for GAP
      dat 0,0
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
      jmp #0, }0

   for GAP
      dat 0,0
   rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;    stone         ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

gate1   equ     (init-7-dist)
pat     equ     DSTEP
dist    equ     3

dwarf   mov.i   bmbr,   init-dist
init    SPL.B   #0,     <stone-pat
stone   SPL.B   #pat,   <-pat
loop    MOV.I   {0+pat, hit-pat
        ADD.F   stone,  loop
hit     DJN.F   loop,   <stone-pat
        MOV.I   init-dist, >gate1
        DJN.F   -1,     {gate1
bmbr    dat.f   #1,     #17

   for GAP
      dat 0,0
   rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;  pspace & boot   ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

PKEY    equ  129

table   nop  2  , w0
        nop  0  , w2
        nop  1  , w1
        nop  2  , w0
        nop  1  , w1

   for 5
      dat 0,0
   rof

w0      dat   DOFF, #dwarf-last+length
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
