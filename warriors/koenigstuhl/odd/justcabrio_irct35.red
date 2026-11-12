;redcode-tiny
;name Just Cabrio
;author LAchi
;strategy  Stone
;assert 1

pgo
Stone     spl    #-76,#76     ; self-splitting, unbooted stone
         mov    -2,<-13      ; with sequential core clear
         add    Stone,1
         mov    >0,-3
         djn.f  -2,{-150

end pgo
