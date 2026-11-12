;redcode-94nop
;name Discord (decoy)
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

       bdist  equ (17*st)

; -----------------------------

       MOV.I  $    46,      -bdist
       MOV.I  {    -1, <    -1
       MOV.I  {    -2, <    -2
       MOV.I  {    -3, <    -3
       MOV.I  {    -4, <    -4
       MOV.I  {    -5, <    -5
       MOV.I  {    -6, <    -6
       MOV.I  {    -7, <    -7
       MOV.I  {    -8, <    -8
       MOV.I  {    -9, <    -9

; . . . . . . . . . . . . . . .

boot    mov    clear+1,  boot+14-bdist
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot

; -----------------------------

        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
        mov    {boot,    <boot
bptr    jmp    @boot

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1

; . . . . . . . . . . . . . . .

       MOV.I  {   -11, <   -11
       MOV.I  {   -12, <   -12
       MOV.I  {   -13, <   -13
       MOV.I  {   -14, <   -14
       JMP.B  @   -15, $     0

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1

; -----------------------------

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1

       ADD.F  $    12, $     1
       SNE.I  $  -402, $  -412
       ADD.X  $    10, $    -1
       SEQ.I  *    -2, @    -2
       SLT.A  #    28, $    -3

; . . . . . . . . . . . . . . .

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1

        st     equ 7599
        gap    equ 10
        count  equ 9

        self   equ dbmb+gap+3-ptrs

scan    add    inc,      ptrs
ptrs    sne    scan+st,  scan+st-gap
        add.x  inc,      ptrs
        seq    *ptrs,    @ptrs
        slt.a  #self,    ptrs

; -----------------------------

        jmz    scan,     #0
wptr    mov.ab ptrs,     #4000
x       mov.x  #15,      dbmb
wipe    mov    inc,      <wptr
        mov    inc,      <wptr
        djn.a  wipe,     dbmb
        jmz    scan,     scan-1
inc     spl    #st,      st
clear   mov    dbmb,     >wipe+2
        djn.f  clear,    {wipe+2

        dbmb   equ x+count

; . . . . . . . . . . . . . . .

       JMZ.B  $    -5, #     0
       MOV.AB $    -5, #  4000
       MOV.X  #    15, $     9
       MOV.I  $     4, <    -2
       MOV.I  $     3, <    -3
       DJN.A  $    -2, $     6
       JMZ.B  $   -11, $   -12
       SPL.B  #  -401, $  -401
       MOV.I  $     3, >    -3
       DJN.F  $    -1, {    -4

; -----------------------------

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1
        spl    #1,       >1
        spl    #1,       @1
        spl    #1,       #1
        spl.a  #1,       1
        dat    0,        0

; . . . . . . . . . . . . . . .

        spl    #1,       1
        spl    #1,       {1
        spl    #1,       }1
        spl    #1,       *1
        spl    #1,       <1
        spl    #1,       >1
        spl    #1,       @1
        spl    #1,       #1
        spl.a  #1,       1

; -----------------------------

        end    boot

