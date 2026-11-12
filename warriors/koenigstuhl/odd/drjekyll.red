;redcode
;name Dr.Jekyll
;author Sascha Zapf
;assert CORESIZE==8000
;strategy Paranoid p^3-Switcher
;strategy First Entry for the Redcoder's Frenzy Round 7

;********************Cloner II********************

SRC	  mov	 FIX,	   -1
CPY	  mov	@SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  djn	 CPY,	   SRC-1
DST	  spl	 @DST,	   5000
HNT	  jmz	 HNT,	   <DST
	  jmp	 SRC
FIX	  dat	 0,	   12
	  dat	 0,	   0
	  dat	 0,	   1

;*************************CLP********************

slDodger  mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          djn    -4       ,#4
btDodger  jmp    pescape+300,pescape

plen      equ    (pescape-p1)

p1        mov    pb       ,@pfence
          mov    pb       ,*pfence
ploop     add    pincr    ,psnare
          mov    psnare   ,@psnare
pfence    sne    pb-46    ,pb+26
          jmp    ploop
          add    preset   ,psnare
          mov    pb       ,pescape
pcopy     mov    >pescape ,}pescape
          jmn.b  -1       ,pescape
preset    jmp    p1+5093  ,-p1-5093
psnare    jmp    ptrap-200,+200
ptrap     mod.x  #10      ,#1
          stp.ab #0       ,#0    ;<-- values of the a- and b-fields can 
be modified during the battle
          djn.b  -1       ,-1
pincr     mov    1        ,-1
pb        dat    5093+p1-pescape,-plen
pescape   dat    0,0

;********************Frontwards************************

offset    equ    608
step      equ    12
stream    equ    cc-806
first     equ    (cc-offset+203)
gate      equ    -50

p         dat    #first,   {first+step
          dat    #30,      {-1
          dat    #30,      {-1
cc        spl    #30,      stream-660
          dat    0,        0
          dat    0,        0
          dat    0,        0
boot      mov    top+5,    top+offset+5
    for 5
          mov    {boot,    <boot
    rof
boot2     mov    cc,       cc+offset
    for 3
          mov    {boot2,   <boot2
    rof
          jmp    x+offset
top       sub    x,        @x
x         sne    *p,       @p
          djn.f  -2,       <stream
          spl    #0,       <p
          mov    @1,       }p
          djn    -1,       <cc

pcell EQU 399
states EQU 3

w0 EQU pSRC   ; Cloner II
w1 EQU slDodger  ; CLP
w2 EQU pboot    ; frontwards

	dat	0,init_state-state
in	dat	0,loss_table-state
	dat	0,win_table-state
	dat	0,tie_table-state

think ldp.a  #0,in              ; get input value
load  ldp.a  #pcell,state      ; load old state
      mod.a  #states,state      ; brainwash protection
      add.ba *in,state          ; select correct state table
store stp.a  *state,load        ; store new state
state jmp    @0

loss_table
	dat	1, w0
init_state
	dat	2, w2
	dat     0, w1

win_table
	dat	0,w0
	dat     1,w1
	dat     2,w2

tie_table
	dat     2,w1
	dat	0,w2
	dat     1,w0

pSRC	mov.i	think,ptrap+1
	jmp SRC

pboot   mov.i   think,ptrap+1
	jmp boot

END think

