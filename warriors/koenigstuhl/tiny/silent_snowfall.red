;redcode-tiny
;name Silent Snowfall
;author inversed
;strategy Stone/Imp
;assert CORESIZE == 800
;date submitted: 2008.03.31

; Due to abundance of oneshots, stone / imp is an attractive 
; strategy  for the tiny  setting.  Yet  somewhy it  remains 
; very unpopular. Launching imps can be tricky: the launcher
; must be compact and achieve the right process balance with
; the stone. Infinite imp spirals may not be the best choice.
; Silent Snowfall employs modified paper-launched imps.  The
; paper  contains  an SPL  generating  extra  imp  processes. 
; Resulting  process order  is a mess,  but the imps  become 
; stronger.

xx1     equ     248
xx2     equ     654
xx3     equ      43
xx4     equ     310

aa1     equ     372
aa2     equ     224
aa3     equ     308
bb1     equ     455
bb2     equ     113
bb3     equ     241

sdjn    equ     663
bdist   equ     591
bdi     equ     625

hop     equ     417
step    equ     2 * hop
time    equ     178
istep   equ     267

x0      equ     (-CURLINE)
bloc    equ     x0 + bdist
iloc    equ     x0 + bdi
org     start

bomb    dat       hop       ,   > 1
s0      spl     # 0         ,     0
loop    mov       bomb      ,   @ ptr
hit     add     # step      ,     ptr
ptr     mov       bomb      ,   } hit - step * time
        djn.f     loop      ,   < sdjn

silk    spl     @ 4         ,   < istep + 1
        mov     } silk      ,   > silk
        spl       istep + 2 ,   { xx1
        mov.i   # istep     ,   * 0

start   mov     { aa1       ,     bb1
        mov     { aa2       ,     bb2
        mov     { aa3       ,     bb3

        spl       1         ,   { xx2
        mov     < bp        ,   { bp
        spl       1         ,   { xx3
        mov     < bp        ,   { bp
        mov     { silk      ,   { bpi
bp      spl     @ bloc + 6  ,     bomb + 6
bpi     djn.f     iloc + 4  ,   { xx4

