;redcode-94
;name Predictable
;author Simon Duff
;assert 1
;strategy P-switching CLP and Cloner2 only  :)
;strategy
;strategy No BrainWash protection. Just trying
;strategy to use CLP to keep opponent in check
;strategy and Cloner2 to get out of trouble.
;strategy
;strategy The P-Space routine could be made more
;strategy complex, given more time. Right now,
;strategy its limited to only 6 states.
;strategy
;strategy Tries cloner initially, then switches
;strategy to CLP and tries varying the brainwash
;strategy value in order to keep the opponent in
;strategy using frontwards, leading to continual
;strategy brainwashing and wins for me :)
;strategy
;strategy Well, thats the idea at least!

_RES  equ   #0    ; Result of last match
_STR  equ   #213  ; P^3 Strategy
_BW   equ   #214  ; Where do I store the brain wash value
;---

think ldp.a    #0, in
      ldp.a    _STR, table
      mod.ba   *in, table
      stp.b    *table, _STR
      
table jmp }0,     441
      dat SRC,    378
      dat clp,    163
      dat clp_m,  100
      dat clp_m,  37 
      dat clp_m,  352

in    dat 0, 8
      spl 1, 7
      spl 1, 9

; load CLP after modifying the BrainWash value      
clp_m ldp.a  _BW,  (ptrap+1)
      add.a  #7,   (ptrap+1)     ;naive increment - may try a different 
prime
      stp.ab (ptrap+1), _BW
      jmp    slDodger

; load CLP using the saved BrainWash value
clp   ldp.a  _BW,  (ptrap+1)
      jmp    slDodger
   
; load Cloner 2 :)
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
end