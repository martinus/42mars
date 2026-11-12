;redcode
;name easter C three
;author Christian Schmidt
;strategy coreclear
;assert 1

bptr1   equ     2000
bptr2   equ     (bptr1+39)

boot    mov     g1,          bptr1
         mov     g2,          bptr1
         mov     b,           bptr2
         mov     b1,          bptr2
boot2   mov     {bptr3,      <bptr3
         mov     {bptr3,      <bptr3
         mov     {bptr3,      <bptr3
         mov     {bptr3,      <bptr3
         jmp     @bptr3,      {0

g1      dat     st+17,       500
g2      dat     -4040,       4045
st      spl     #b-g1+35,    45
         mov     *g1-17,      >g1-17
         mov     *b+18,       >g2-17
cc      djn.f   -1,          {g2-17
b       dat     #1,          45
b1      spl     #-40,        45

bptr3   dat     cc+1,        boot2+bptr1+19

end boot
