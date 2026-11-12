;redcode-icws
;name The Utterer T
;author Christian Schmidt
;strategy qscanner, spreader
;strategy optimized for ICWS hill
;assert 1
;optimax pwi

sOff   equ 6537
sAwa   equ 4240

iOff   equ 1269
iAwa   equ 2742

iStep  equ 2731

;2731 ;3pt; 3277 ;5pt; 3511 ;7pt

boot	  spl	    1
	  spl	    1
        spl     iBoo

sBoo    mov     <sSrc,  <sDist
sSrc    spl     @sDist, sEnd+1
        add     #sAwa,  sDist
        add     #1,     sSrc
sDist   jmp     sBoo,   sOff

iBoo    mov     <iSrc,  <iDist
iSrc    jmp     @iDist, imp+1
        add     #iAwa,  iDist
        add     #1,     iSrc
iDist   jmp     iBoo,   iOff

step   equ      3013
time   equ      5918
dd     equ      7

stone  mov <dd+1+(2*time), 3+(step*time)
       spl  -1, <2-step
       add   1,   -2
sEnd   djn  -2, <0-step

vortex spl	0
	 add	#iStep, launch
launch jmp	@0	, imp-(iStep+1)
imp	 mov	0	, iStep


   for 40
       dat   #0,       #0
   rof

qs    equ 322
qd    equ 161

qscan cmp 2*qs+qd       , 2*qs
qt1   jmp qa0           , <3*qs
      cmp qscan+5*qs+qd , qscan+5*qs
qt2   jmp qa1           , <4*qs
      cmp qscan+4*qs+qd , qscan+4*qs
qs1   djn qa1           , #qt1
      cmp qscan+10*qs-2 , qscan+10*qs+qd-2
qs2   djn qa2           , #qt2
      cmp qscan+9*qs+qd , qscan+9*qs
qt3   jmp qa2           , <6*qs
      cmp qscan+6*qs+qd , qscan+6*qs
      jmp qa2           , <qa1
      cmp qscan+8*qs+qd , qscan+8*qs
      jmp qa2           , <qs1
      cmp qscan+11*qs   , qscan+11*qs+qd
      jmp qa3           , <qa2
      cmp qscan+18*qs-8 , qscan+18*qs+qd-8
qs3   djn qa3           , #qt3
      cmp qscan+16*qs-2 , qscan+16*qs+qd-2
      jmp qa3           , <qs2
      cmp qscan+12*qs   , qscan+12*qs+qd
      jmp qa3           , <qa1
      cmp qscan+14*qs   , qscan+14*qs+qd
      jmp qa3           , <qs1
      jmz boot          , qscan+15*qs

qa3   add @qs3          , qp
qa2   add @qs2          , @qa3
qa1   add @qs1          , @qa3
qa0   cmp @qp           , <1234
      cmp @0            , 0
      add #qd           , qp
ql    mov qb            , @qp
qp    mov <2345         , <qscan+2*qs
      sub #9            , @ql
      djn ql            , #6
qb    jmp boot          , <43

      end qscan

