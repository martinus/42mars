;redcode-mp
;name Leaflets everywhere
;author inversed
;strategy Fairly basic LP-style paper
;assert (CORESIZE == 8000)

bofs    equ     7754
pofs    equ     3618
pinc    equ     5996
color   equ     2000
bdist   equ     pap+len+4000
derp    equ     2667
ikill   equ     2667
len     equ     9

org     copy+1

copy    mov     < pap   ,   { bptr
        mov     < pap   ,   { bptr
        mov     < pap   ,   { bptr
        mov     < pap   ,   { bptr
        mov     < pap   ,   { bptr
        jmn       copy  ,     pap
bptr    spl       bdist ,   { derp

pap     mov     # len   ,   # len
        add.a   # pinc  ,     to
loop    mov     < pap   ,   { to
        mov       kill  ,   > bofs
        mov       kill  ,   > bofs-1
        jmn       loop  ,     pap
        spl       pap   ,   { color
to      jmz       pofs  ,   * 0
kill    dat     < ikill ,   < 2*ikill
