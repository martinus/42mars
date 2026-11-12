;redcode-88x 
;name Borrow before Tomorrow!
;author Roy van Rijn 
;strategy All stolen code, but it uses p-space 
;strategy My other warriors where all single strategy, 
;strategy so I desided to make one using the extended rules! 
;strategy Switches between Michal's Quicksilver '88 and John's '88 Test IV 
;assert 1 

res  ldp #0,      res 
str  ldp pkey,    0 
    cmp #1,      res 
    add #4000,   str 
    stp str,     pkey 
    slt #3999,   str 
    jmp go 
pkey jmp boot,    #242 

sdist equ 4857 
dboff equ 11 
idist equ 7706 
ioff  equ 5817 

boot  mov imp+1         , sdist+dboff 
iboot spl 2             , boot+idist+3 
     spl 1             , boot+ioff+3 
     mov imp           , <-1 
     mov <stone        , <iboot 
     mov -3            , 0 
     mov <stone        , <sboot 
     djn boot+sdist    , #5 
sboot djn boot+idist    , #boot+sdist+5 

stone spl 0             , imp 
     mov stone+dboff   , <-123 
     mov stone+dboff   , @-1 
     add #-107         , -2 
     djn -3            , <5246 

     spl 0             , 0 
     add #2668         , 1 
     jmp @0            , ioff-idist-2670 

imp   mov 0             , 2667 
     dat <1            , #17 

st    equ  -11 
fi    equ  (175*11-3993) 
boot1 equ  (go-fi-100) 

kill    dat <2667,    <-11 

clear   spl 0,        <kill-sptr-8 
cloop   mov @sloop,   <sptr 
       mov @sloop,   <sptr 
bomb    djn cloop,    <kill-5 

steps   dat <st*3,    <st*3+1 

sloop   add steps,    @cloop 
       mov kill,     <sptr 
sptr    cmp fi+st*2,  @fi+1 
       jmp <sloop 
e       jmp sloop 

go      mov e, boot1+10 
a       for 10 
       mov kill+10-a,<go 
       rof 
       jmp boot1+7 
end     res 
