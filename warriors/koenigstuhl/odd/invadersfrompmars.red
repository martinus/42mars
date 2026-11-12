;redcode-94nop
;name invaders from pMars
;author Simon Wainwright
;strategy oneshot
;assert 1

st equ 264

gate   dat        0,   ptr-7
       dat        0,       0
bptr   dat        1,      10
squash spl    #1800,      12
clear  mov    *bptr,   >gate
       mov    *bptr,   >gate
       djn.f  clear, }squash
       for        7
       dat        0,       0
       rof
inc    spl   #-st*2,  <-st*2
scan   sub      inc,     ptr
ptr    sne     st*2,      st
       sub      inc,     ptr
p      sne     *ptr,    @ptr
       djn.f   scan,    @ptr
       add.f     @p,    gate
       sne     @ptr,  <-1197
       add.x    #st,    gate
       djn.f squash,   <1195
       end      ptr

