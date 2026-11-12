;redcode-nano
;name shades of amber grey
;author John Metcalf
;strategy paper
;assert CORESIZE==80

     step  equ pap+52

     mov   >61,      15

pap  spl   #0,       <step
     mov   }pap,     >pap
     mov   >11,      <-9
     djn.f *step+1,  <-5

     end

