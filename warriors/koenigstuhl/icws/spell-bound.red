;redcode-icws
;name Spell-Bound
;author Ian Oversby
;strategy Imp/Stone
;assert CORESIZE==8192

idist   equ     (sdist-2530)
sdist   equ     5500

;;-------------------------------------------------------------------

for 8
        DAT     #1,     <1
        DAT     <1,     <1
        DAT     #1,     <1
rof

;;----------------------- Boot the stone ----------------------------

boot    MOV     cbomb,  @sptr2
        SPL     iboot,  <-200
for 6
        MOV     <spos,  <sptr
rof
        SPL     @sptr,  <-200
        MOV     <spos,  <sptr
sptr    DAT     #sdist, #sdist
sptr2   DAT     #sdist, #sdist-2+76

cbomb   DAT     <-51,   <-51
        SPL     0,      <-50
first   SPL     0,      <-1999
str     SPL     0,      <-2000
loop    MOV     <-2+76, 2-76
        ADD     clr,    loop
        DJN     loop,   <-2000+str
clr     MOV     76,     <-76
spos    DAT     #0,     #0


;;--------------------- Boot the imp/launch -------------------------

iboot   MOV     <ipos,  <iptr
for 5
        MOV     <ipos,  <iptr
rof
        JMP     @iptr,  <-300

iptr    DAT     #idist, #idist
        DAT     #0,     #0

spin    SPL     0,      <-120
        ADD     #2732,  jump
jump    JMP     @0,     impy-2732
impy    MOV     0,      2731
        MOV     0,      2731
        MOV     0,      2731

ipos    DAT     #0,     #0

;;-------------------------------------------------------------------

for 13
        DAT     #1,     <1
        DAT     <1,     #1
        DAT     #1,     #1
rof

end boot

