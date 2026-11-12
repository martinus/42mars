;redcode-94nop
;name CCPaper strikes back
;author Christian Schmidt
;strategy paper
;assert 1

for 3                              ; 4 chars
      spl    1                     ; 4 chars
rof                                ; 3 chars

i  for  3                          ; 5 chars
      spl    @0,     <i*860+7215   ;17 chars
      mov    }-1,    >-1           ;10 chars
rof                                ; 3 chars
      mov.i  #1,     <1            ;10 chars
      djn    -2,     <563          ;10 chars
                                 ;->66 chars