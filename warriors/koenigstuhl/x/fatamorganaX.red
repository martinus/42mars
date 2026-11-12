;redcode-94x quiet
;name Fatamorgana X
;author Zul Nadzri
;assert 1
;strategy Engine : Predator Technology ver2.0 + SureWin ver2.0
;strategy Warrior: The X Machine + additional scanner
;strategy April 2004

;@@@@@@@@@@@@@@@@@@@@ [Predator ver2 - 73 lines ] @@@@@@@@@@@@@@@@@@@@@@@
maxdraw        equ 4                                ;maximum draw-in-a-row allowed
compa                equ count+CORESIZE/3
compb                equ compa+1
compc                equ compb+1
compd                equ compc+1
war1loc                equ dBoot-exec
war2loc         equ kBoot-exec
war3loc                equ mula-exec
war4loc         equ sBoot-exec
pbwashval        equ 651                        ;bwash secret value

init                equ 11
pbwashbox        equ init+4                ;bwash detector box
pactivebox        equ pbwashbox+10        ;current warrior box
pincrlocbox         equ pactivebox+10        ;location to be incremented/decremented
pdrawbox        equ pincrlocbox+10        ;draw statistic

normal                ldp #pbwashbox, #0        ;load brainwash stored value
                seq #pbwashval, normal        ;check brainwash
                jmp bwash                ;brainwashed !!
active                ldp #pactivebox, #0        ;load activebox number eg "1" or "2"        [1 - active]
                ldp.a #pincrlocbox, incrlocbox        ;increment at this box        eg "23"
                ldp #pincrlocbox, incrloc
incrlocbox        ldp.a #0, incrloc        ;                                        [3 - result]
check                seq #2, start                ;check draw first to fast loading
                jmp WL                        ;check next states
draw                ldp.a #pdrawbox, drawval ;load currbox value eg "1" or "4"
                add.a #1, drawval        ;increment draw series
gula1                sne.a #maxdraw, drawval        ;check for max draw allowed
                jmp drawadjust                ;reset draw value
drawval                stp #0, #pdrawbox        ;save curr value to currbox
                sne #1, active
                jmp exec
                sne #2, active
                jmp drawb
                sne #3, active
                jmp drawc
                jmp drawd                ;20

drawadjust        stp #0, #pdrawbox        ;reset draw to zero
                jmp lose                ;assume it as lost

WL                seq #1, start                ;check for win
lose                sub.a #2, 1                ;reduce for a lost
win                add.a #1, 1                ;increment if won
incrloc                stp #0, #0                ;{+1 at 23}                        [2 - ploc]
select                mul #10, active                ;        madu1
                add.ba active, comp1        ;                                {31, 32}
                add.ba active, comp2        ;                                {31, 32}
                add.ba active, comp3        ;                                {31, 32}
                add.ba active, comp4        ;                                {31, 32}
gula2                ldp.a comp1, compa        ;                                {0,32}
                ldp.a comp2, compb        ;                                {0,0}
                ldp.a comp3, compc        ;                                {0,34}
                ldp.a comp4, compd        ;                                {0,0)
compare        slt.a compb, compa        ;                                
                jmp bcd, }exec                ;exec=2 increment for b
acd                slt.a compc, compa
                jmp cd
ad                 slt.a compd, compa        ;madu6
                jmp d
a                stp #1, #pactivebox         ;input active warrior
comp1                stp #1, #pincrlocbox        ;input active box (will be added by 10s during calc)
                jmp exec

gula3                dat 0,0                        ;45

d                stp #4, #pactivebox
comp4                stp #4, #pincrlocbox
drawd                mov.a #war4loc, exec
                jmp exec

bcd                slt.a compc, compb
                jmp cd
                slt.a compd, compb
                jmp d
b                stp #2, #pactivebox
comp2                stp #2, #pincrlocbox
drawb                mov.a #war2loc, exec
                jmp exec

cd                slt.a compd, compc
                jmp d
c                stp #3, #pactivebox
comp3                stp #3, #pincrlocbox
drawc                mov.a #war3loc, exec
                jmp exec

bwash                stp #300, #11                ;reset to zero
                nop 0, >bwash
gula4                djn bwash, #5                ;continue for all
                add #5, -1
                add #5, bwash
                djn bwash, #4
                stp #pbwashval, #pbwashbox        ;reset brain to init value
                stp #1, #pactivebox        ;enter starting value to box
                stp #init, #pincrlocbox
                stp #0, #pdrawbox

exec                jmp war1loc
;@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

;--------------------- fire and ice stone ; dclear for scannner
dDist  equ (dBoot+43990)
dGate  equ    -5
dStep  equ 53421
dbPos  equ    11

dBoot  spl  dBoot2, >dDist+(dPtr-dTop)+dStep*1030        
       spl       1, >dDist+(dPtr-dTop)+dStep*1033
       mov.i    {0, #0                                
       mov   {dSpl, <dAway1
gula5  mov   {dSpl, <dAway2                                ;80  madu2
       jmp }dAway1, >dBoot2                
dAway1 dat dDist+1,  dDist+(dLast-dTop)+1                        

       dat 0, 0                                                        
       dat 0, 0                                                ;BOMBED

dDat   dat <27721, 5-dGate

dSpl   spl     #dLast+1, {dSpl+dGate+2        
       mov dSpl+dGate+1, >dSpl+dGate
gula6  djn.f         -1, >dSpl+dGate

dTop   add.ab #dStep*2, dPtr
       mov      >2,    @dPtr        
dPtr   mov      <1,    *(dStep*2)                        ;90          
madu5  jmn.b  dTop,     dTop+dbPos
dLast  jmp dPtr+dStep, <dGate-1

dBomb  mov dStep, 1

       dat 0, 0
       dat 0, 0                        

dBoot2 mov   dBomb,  dDist+dbPos
       spl       1, {dDist+(dPtr-dTop)+dStep*1036
       mov   {dSpl, <dAway1        
dAway2 mov    dDat, <dDist+(dPtr-dTop)+dStep+3
gula7   jmp >dAway1, <dAway2                        

;--------------------- Recon2 ----------------------------------
step equ 4876 ;4857 ;4394 ;4771 ;4394 ;1142 vs time ;21179 ;16557  

ptr equ (scan-8)
kAway         equ        CORESIZE/2

kay        dat 2,   kAway
        dat 0,0
        dat      19,  19
diff    spl  #-step, #-step
wipe    mov    diff, >ptr     ; hit 'em with SPLs
w2      mov   *wipe, >ptr     ; later, this becomes a DAT clear
        djn.a  wipe,  length

loop    sub    diff, @s2
scan    sne (step*2) - 1, (step*2) - 7   ; check a pair
        sub    diff,  scan
s2      seq   *scan, @scan    ; check another pair
        slt.a   #20,  scan    ; ignore self
timer   djn    loop, #25000    ; count down to DAT phase

length  sub.ba #0,  #-7      ; set up for SPL wipe
tweak   mov.ab @s2, @wipe
t2      jmn    *w2,  timer   ; when timer expires,
        djn.a  <tweak, {t2   ; go to DAT clear mode

kBoot   mov }kay, >kay
gula8   mov }kay, >kay
        mov }kay, >kay
        mov }kay, >kay                
        mov }kay, >kay                
        djn kBoot, #3
        spl kAway-15
        mov select+1, select+1+6
        mov gula5+1, gula5+1+6
        mov madu3+1, madu3+1+6
        mov madu4, madu4+6
gula9        mov madu5+1, madu5+1+6                                
        mov ad, ad+6                                
madu3        dat 0,0                        ;madu3 131


;-------------------------- ccpaper for pure rock
len     EQU 9
QB      EQU (start+400)
fcp     EQU (3039*3)
scp     EQU (2365*2)
tcp     EQU (777)
QS      EQU 1000
QD      EQU 500

mula    spl 1,<-30000
        mov -1,0
gula10  mov -1,0
        mov -1,0                                        

             spl     @frog,  >-1000         
        mov     }-1,    >frog                 
          dat     >-300,  <300           
               
frog    spl     @0,     <fcp-len        
sweet          mov     }-1,    >-1                        
        spl     @0,     <scp
        mov     }-1,    >-1                
        spl     @0,     <tcp
madu7   mov     }-1,    >-1                
        mov     2,      <-1
        jmp     -1,     <-10
gula50  dat            {34117,        <34117

;---------------- fire and ice ; the truth is out there
;sBoot dat 2
;sBoot jmp 0
sBoot  mov }sBP, >sAway
       mov }sBP, >sAway
       mov }sBP, >sAway
       mov }sBP, >sAway                
       mov }sBP, >sAway                
       djn sBoot, #4                        
       spl *sAway,  >sBoot                
sAway  mod.f #sDist+(sStart-sPtr), #sDist ;gula11
        mov gula, sI2+1
        mov gula, gula5+1
        mov gula, gula10+1
        mov gula, gula9+1
        mov gula, gula7+1
        mov gula, gula3+1
        mov gula, sAway+1
        
gula        dat 0,0

sDist equ 19241+18-4
sStep equ 13379
sTop  equ (sPtr-1)

sPtr   jmn.f #sStep-1, {sTop
sI1    sne.b  }sTop, *sTop
       mov.ab *sTop, *sTop
        jmz.b  sMain, *sTop
sI2    mov.ab  @sI1, @sI1                ;g12
       add.ba *sTop, @sI1        
       mov     sSpl, >sTop                ;170
       jmn.f     -1, @sTop                ;
       mov    sWash, >sTop
sGate  slt.ab  @sI1, #27
sI3    jmn.f   sPtr, @sI2
sMain  add.a #sStep-1, sPtr                ;
sStart jmz.f     -1, }sPtr        
       mov.a   sPtr, @sI1
       jmn.a  sGate, *sI3
sSpl   spl   #0,  0        
       mov    2, >sGate                
       djn.f -1, {sGate                        ;
sBP    dat sPtr, 3-sGate
sWash  stp.ab >0, #0

madu4  dat 0,0                                ;184

;###################### [ SureWin ver2 : 15 lines ] #######################
pbox                 equ 300                        ;place to store bwash code
pnum                equ 300                        ;value fo the bwash code
pmula                equ 1-(MAXLENGTH+10)

start                ldp #0, #0                ;load status
                sne.ab #-1, -1                ;skip first round
                jmp x1                        ;first round de tour
test                ldp #pbox, #0                ;bwash load
                seq.ab #pnum, -1        ;bwash test
                jmp normal                ;bwashed !! - switch to normal
                seq.ab #0, start        ;skip if loser
                jmp x1                        ;winner
                stp #1,#pbox                ;reset brain
                nop 0,0                        ;wait
                dat 0                        ;die

x1                stp #pnum, #pbox        ;bwash protection
seek                jmz.f seek, {count        ;continue searching
count                sne.i #pmula, {count        ;compare
                jmp $0, {count                ;jmp if start first, dat 0 if start second
;##########################################################################

end start
;end normal
;end sBoot

